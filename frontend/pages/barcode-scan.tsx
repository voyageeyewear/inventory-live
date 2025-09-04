import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import Webcam from 'react-webcam'
import { BrowserMultiFormatReader } from '@zxing/library'
import { 
  Camera, 
  CameraOff, 
  Package, 
  Plus, 
  Minus, 
  Search,
  AlertCircle,
  CheckCircle,
  RotateCcw,
  Scan
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface Product {
  _id: string
  sku: string
  product_name: string
  quantity: number
  price: number
  category: string
  supplier: string
}

interface StockTransaction {
  type: 'in' | 'out'
  quantity: number
  notes: string
}

export default function BarcodeScan() {
  const [isScanning, setIsScanning] = useState(false)
  const [scannedCode, setScannedCode] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [transaction, setTransaction] = useState<StockTransaction>({
    type: 'in',
    quantity: 1,
    notes: ''
  })
  const [manualSku, setManualSku] = useState('')
  const [showManualEntry, setShowManualEntry] = useState(false)
  
  const webcamRef = useRef<Webcam>(null)
  const codeReader = useRef<BrowserMultiFormatReader | null>(null)
  const scanInterval = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  // Initialize barcode reader
  useEffect(() => {
    codeReader.current = new BrowserMultiFormatReader()
    return () => {
      if (codeReader.current) {
        codeReader.current.reset()
      }
      if (scanInterval.current) {
        clearInterval(scanInterval.current)
      }
    }
  }, [])

  // Start scanning
  const startScanning = useCallback(async () => {
    setIsScanning(true)
    setScannedCode('')
    setProduct(null)
    
    try {
      // Get video stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      })
      
      if (webcamRef.current?.video) {
        webcamRef.current.video.srcObject = stream
      }

      // Start scanning with better interval and error handling
      scanInterval.current = setInterval(async () => {
        if (webcamRef.current && codeReader.current && isScanning) {
          try {
            const imageSrc = webcamRef.current.getScreenshot()
            if (imageSrc) {
              const img = new Image()
              img.onload = async () => {
                const canvas = document.createElement('canvas')
                const context = canvas.getContext('2d')
                if (context) {
                  canvas.width = img.width
                  canvas.height = img.height
                  context.drawImage(img, 0, 0)
                  
                  try {
                    const result = await codeReader.current?.decodeFromCanvas(canvas)
                    if (result) {
                      const code = result.getText()
                      console.log('Barcode detected:', code)
                      setScannedCode(code)
                      setIsScanning(false)
                      if (scanInterval.current) {
                        clearInterval(scanInterval.current)
                      }
                      lookupProduct(code)
                      toast.success(`Barcode scanned: ${code}`)
                    }
                  } catch (error) {
                    // No barcode found in this frame, continue scanning
                    console.log('No barcode found in frame')
                  }
                }
              }
              img.onerror = () => {
                console.log('Error loading image for scanning')
              }
              img.src = imageSrc
            }
          } catch (error) {
            console.log('Scanning error:', error)
          }
        }
      }, 300) // Faster scanning - every 300ms
      
    } catch (error) {
      console.error('Camera access error:', error)
      toast.error('Could not access camera. Please check permissions.')
      setIsScanning(false)
    }
  }, [isScanning])

  // Stop scanning
  const stopScanning = useCallback(() => {
    setIsScanning(false)
    if (scanInterval.current) {
      clearInterval(scanInterval.current)
    }
  }, [])

  // Look up product by SKU
  const lookupProduct = async (sku: string) => {
    setLoading(true)
    try {
      const response = await axios.get(`/api/products?search=${encodeURIComponent(sku)}`)
      const products = response.data.products || response.data
      
      // Find exact SKU match
      const foundProduct = products.find((p: Product) => 
        p.sku.toLowerCase() === sku.toLowerCase()
      )
      
      if (foundProduct) {
        setProduct(foundProduct)
        toast.success(`Product found: ${foundProduct.product_name}`)
      } else {
        toast.error(`No product found with SKU: ${sku}`)
        setProduct(null)
      }
    } catch (error: any) {
      toast.error('Error looking up product: ' + (error.response?.data?.message || error.message))
      setProduct(null)
    } finally {
      setLoading(false)
    }
  }

  // Handle manual SKU lookup
  const handleManualLookup = () => {
    if (!manualSku.trim()) {
      toast.error('Please enter a SKU')
      return
    }
    setScannedCode(manualSku.trim())
    lookupProduct(manualSku.trim())
  }

  // Process stock transaction
  const processTransaction = async () => {
    if (!product || !transaction.quantity || transaction.quantity <= 0) {
      toast.error('Please ensure all fields are filled correctly')
      return
    }

    setLoading(true)
    try {
      const endpoint = transaction.type === 'in' ? '/api/stock/in' : '/api/stock/out'
      const response = await axios.post(endpoint, {
        sku: product.sku,
        quantity: transaction.quantity,
        notes: transaction.notes || `Barcode scan ${transaction.type === 'in' ? 'stock-in' : 'stock-out'}`
      })

      toast.success(`Successfully processed ${transaction.type === 'in' ? 'stock-in' : 'stock-out'} for ${product.product_name}`)
      
      // Update product quantity locally
      setProduct(prev => prev ? {
        ...prev,
        quantity: transaction.type === 'in' 
          ? prev.quantity + transaction.quantity
          : prev.quantity - transaction.quantity
      } : null)

      // Reset transaction
      setTransaction({
        type: 'in',
        quantity: 1,
        notes: ''
      })

      // Refresh sync status if available
      if ((window as any).refreshSyncStatus) {
        (window as any).refreshSyncStatus()
      }

    } catch (error: any) {
      toast.error('Transaction failed: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  // Reset everything
  const resetScan = () => {
    setScannedCode('')
    setProduct(null)
    setManualSku('')
    setTransaction({
      type: 'in',
      quantity: 1,
      notes: ''
    })
    stopScanning()
  }

  return (
    <ProtectedRoute requiredPermission="viewProducts">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Scan className="h-8 w-8 text-blue-600" />
                  Barcode Scanner
                </h1>
                <p className="text-gray-600 mt-1">
                  Scan product barcodes to quickly manage stock in/out operations
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowManualEntry(!showManualEntry)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  <Search className="h-4 w-4" />
                  Manual Entry
                </button>
                <button
                  onClick={resetScan}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Camera Section */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Camera Scanner
              </h2>
              
              <div className="space-y-4">
                {/* Camera View */}
                <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  {isScanning ? (
                    <div className="relative">
                      <Webcam
                        ref={webcamRef}
                        audio={false}
                        screenshotFormat="image/jpeg"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 border-4 border-blue-500 border-dashed animate-pulse">
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-500 bg-opacity-75 text-white px-3 py-1 rounded text-sm font-medium">
                          Scanning for barcode...
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <CameraOff className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">Camera not active</p>
                        <p className="text-sm text-gray-400">Click "Start Scanning" to begin</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Camera Controls */}
                <div className="flex gap-2">
                  {!isScanning ? (
                    <button
                      onClick={startScanning}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
                    >
                      <Camera className="h-4 w-4" />
                      Start Scanning
                    </button>
                  ) : (
                    <button
                      onClick={stopScanning}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium"
                    >
                      <CameraOff className="h-4 w-4" />
                      Stop Scanning
                    </button>
                  )}
                </div>

                {/* Manual Entry */}
                {showManualEntry && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Manual SKU Entry</h3>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={manualSku}
                        onChange={(e) => setManualSku(e.target.value)}
                        placeholder="Enter SKU manually"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && handleManualLookup()}
                      />
                      <button
                        onClick={handleManualLookup}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium disabled:bg-gray-400"
                      >
                        Lookup
                      </button>
                    </div>
                    {/* Test with your barcode */}
                    <div className="text-xs text-gray-500 mb-2">Quick test with your barcode:</div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setManualSku('116006FMG7026')
                          setTimeout(() => handleManualLookup(), 100)
                        }}
                        className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                      >
                        116006FMG7026
                      </button>
                      <button
                        onClick={() => {
                          setManualSku('116006FMG')
                          setTimeout(() => handleManualLookup(), 100)
                        }}
                        className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                      >
                        116006FMG
                      </button>
                    </div>
                  </div>
                )}

                {/* Scanned Code Display */}
                {scannedCode && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-800">Scanned Code:</span>
                      <code className="bg-green-100 px-2 py-1 rounded text-green-800 font-mono">
                        {scannedCode}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Product & Transaction Section */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Information
              </h2>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading...</span>
                </div>
              ) : product ? (
                <div className="space-y-6">
                  {/* Product Details */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{product.product_name}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">SKU:</span>
                        <span className="ml-2 font-mono">{product.sku}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Current Stock:</span>
                        <span className="ml-2 font-semibold">{product.quantity}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Price:</span>
                        <span className="ml-2">${product.price}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Category:</span>
                        <span className="ml-2">{product.category}</span>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Form */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Stock Transaction</h3>
                    
                    {/* Transaction Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Transaction Type
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setTransaction(prev => ({ ...prev, type: 'in' }))}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium ${
                            transaction.type === 'in'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Plus className="h-4 w-4" />
                          Stock In
                        </button>
                        <button
                          onClick={() => setTransaction(prev => ({ ...prev, type: 'out' }))}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium ${
                            transaction.type === 'out'
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Minus className="h-4 w-4" />
                          Stock Out
                        </button>
                      </div>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={transaction.quantity}
                        onChange={(e) => setTransaction(prev => ({ 
                          ...prev, 
                          quantity: parseInt(e.target.value) || 1 
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={transaction.notes}
                        onChange={(e) => setTransaction(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Add notes about this transaction..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      onClick={processTransaction}
                      disabled={loading || !transaction.quantity || transaction.quantity <= 0}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium ${
                        transaction.type === 'in'
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      } disabled:bg-gray-400`}
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : transaction.type === 'in' ? (
                        <Plus className="h-4 w-4" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                      Process {transaction.type === 'in' ? 'Stock In' : 'Stock Out'} 
                      ({transaction.quantity} units)
                    </button>
                  </div>
                </div>
              ) : scannedCode ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Product Not Found</h3>
                  <p className="text-gray-600 mb-4">
                    No product found with SKU: <code className="bg-gray-100 px-2 py-1 rounded">{scannedCode}</code>
                  </p>
                  <button
                    onClick={() => router.push(`/add-product?sku=${encodeURIComponent(scannedCode)}`)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Add New Product
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Product Selected</h3>
                  <p className="text-gray-600">
                    Scan a barcode or enter a SKU manually to get started
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
