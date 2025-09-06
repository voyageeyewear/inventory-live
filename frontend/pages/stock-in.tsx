import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { Upload, TrendingUp, Clock, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface StockLog {
  id: number
  sku: string
  quantity: number
  previous_quantity: number
  new_quantity: number
  type: string
  notes: string
  user_name: string
  created_at: string
  product_name: string
}

export default function StockIn() {
  const { user, isFullyAuthenticated } = useAuth()
  const [stockLogs, setStockLogs] = useState<StockLog[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<any>(null)

  useEffect(() => {
    if (isFullyAuthenticated) {
      fetchStockLogs()
    }
  }, [isFullyAuthenticated])

  const fetchStockLogs = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/stock-logs?type=stock_in&limit=50')
      setStockLogs(response.data.data || response.data || [])
    } catch (error: any) {
      console.error('Fetch stock logs error:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch stock logs')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file')
      return
    }

    setUploading(true)
    setUploadResults(null)
    const formData = new FormData()
    formData.append('csv', file)

    try {
      const response = await axios.post('/api/stock/bulk-in', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      
      if (response.data.success) {
        toast.success(`Successfully processed ${response.data.count} stock-in entries`)
        setUploadResults(response.data.results)
        fetchStockLogs()
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.response?.data?.message || 'Upload failed')
      if (error.response?.data?.results) {
        setUploadResults(error.response.data.results)
      }
    } finally {
      setUploading(false)
      // Reset file input
      event.target.value = ''
    }
  }

  return (
    <ProtectedRoute requiredPermission="viewProducts">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock-In</h1>
              <p className="text-gray-600">Add inventory to existing products via CSV upload</p>
            </div>
            <button
              onClick={fetchStockLogs}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium text-blue-800">Refresh</span>
            </button>
          </div>

        {/* Upload Section */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Stock-In CSV</h2>
          <div className="border-2 border-dashed border-green-300 rounded-lg p-6 bg-green-50">
            <div className="text-center">
              <TrendingUp className="mx-auto h-12 w-12 text-green-500" />
              <div className="mt-4">
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Upload Stock-In CSV
                  </span>
                  <span className="mt-1 block text-sm text-gray-500">
                    CSV format: SKU, Quantity (adds to existing stock)
                  </span>
                  <input
                    id="csv-upload"
                    name="csv-upload"
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <span className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
                    {uploading ? 'Processing...' : 'Choose File'}
                  </span>
                </label>
              </div>
            </div>
          </div>
          
          {/* Example format */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Example CSV Format:</h3>
            <pre className="text-xs text-gray-600">
{`SKU,Quantity
SKU123,20
SKU124,10
SKU125,5`}
            </pre>
          </div>
        </div>

        {/* Upload Results */}
        {uploadResults && (
          <div className="bg-white rounded-lg shadow border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Upload Results</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Success Summary */}
              {uploadResults.processed > 0 && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">{uploadResults.processed} products updated successfully</span>
                </div>
              )}

              {/* Errors Summary */}
              {uploadResults.errors && uploadResults.errors.length > 0 && (
                <div className="flex items-center gap-2 text-red-700 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">{uploadResults.errors.length} errors encountered</span>
                </div>
              )}

              {/* Success Details */}
              {uploadResults.success && uploadResults.success.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">✅ Successfully Updated:</h4>
                  <div className="bg-green-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {uploadResults.success.map((item: string, index: number) => (
                      <div key={index} className="text-sm text-green-800">{item}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Details */}
              {uploadResults.errors && uploadResults.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">❌ Errors:</h4>
                  <div className="bg-red-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {uploadResults.errors.map((error: string, index: number) => (
                      <div key={index} className="text-sm text-red-800">{error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stock Logs */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Stock-In Activity</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              {stockLogs.length} entries
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading stock logs...</p>
            </div>
          ) : stockLogs.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">No stock-in activity yet. Upload a CSV to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock Change
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stockLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{log.product_name || 'Unknown Product'}</div>
                        {log.notes && (
                          <div className="text-xs text-gray-500 mt-1">{log.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{log.sku}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            +{log.quantity}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({log.previous_quantity} → {log.new_quantity})
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{log.user_name || 'System'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
    </ProtectedRoute>
  )
}

