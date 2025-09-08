import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { 
  Upload, 
  Package, 
  Eye, 
  RefreshCw, 
  CheckSquare, 
  Square, 
  History, 
  X, 
  Edit, 
  Save, 
  Trash2, 
  RotateCw, 
  FileText,
  Store,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  BarChart3,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Zap
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

interface Product {
  id: number
  sku: string
  product_name: string
  category: string
  price: string
  quantity: number
  description: string
  image_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface DashboardStats {
  totalProducts: number
  connectedStores: number
  todaysSyncs: number
  stockChanges: number
  lowStockItems: number
  totalValue: number
  activeProducts: number
  inactiveProducts: number
  recentActivity: any[]
  syncStats: {
    successful: number
    failed: number
    pending: number
  }
}

export default function ProductsEnhanced() {
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [productsPerPage] = useState(50)
  const [editingProduct, setEditingProduct] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    product_name: '',
    category: '',
    quantity: '',
    description: '',
    image_url: ''
  })
  const [stores, setStores] = useState<any[]>([])
  const [showStoreSelector, setShowStoreSelector] = useState(false)
  const [selectedStore, setSelectedStore] = useState<string>('')
  const [bulkSyncing, setBulkSyncing] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [auditData, setAuditData] = useState<any>(null)
  const [loadingAudit, setLoadingAudit] = useState(false)

  const { user, isFullyAuthenticated } = useAuth()

  useEffect(() => {
    if (isFullyAuthenticated) {
      fetchProducts()
      fetchStores()
      fetchDashboardStats()
    }
  }, [isFullyAuthenticated])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/products')
      setProducts(response.data || [])
    } catch (error: any) {
      console.error('Error fetching products:', error)
      toast.error('Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  const fetchStores = async () => {
    try {
      const response = await axios.get('/api/stores')
      setStores(response.data.filter((store: any) => store.connected))
    } catch (error) {
      console.error('Failed to fetch stores:', error)
    }
  }

  const fetchDashboardStats = async () => {
    try {
      // Fetch comprehensive dashboard statistics
      const [productsRes, storesRes, stockLogsRes] = await Promise.all([
        axios.get('/api/products'),
        axios.get('/api/stores'),
        axios.get('/api/stock-logs?limit=10')
      ])

      const allProducts = productsRes.data || []
      const allStores = storesRes.data || []
      const recentLogs = stockLogsRes.data.stockLogs || []

      // Calculate statistics
      const activeProducts = allProducts.filter((p: Product) => p.is_active).length
      const inactiveProducts = allProducts.filter((p: Product) => !p.is_active).length
      const connectedStores = allStores.filter((s: any) => s.connected).length
      const lowStockItems = allProducts.filter((p: Product) => p.quantity < 10).length
      
      // Calculate total inventory value (assuming average price of $10 if no price)
      const totalValue = allProducts.reduce((sum: number, p: Product) => {
        const price = parseFloat(p.price) || 10
        return sum + (price * p.quantity)
      }, 0)

      // Get today's activities
      const today = new Date().toISOString().split('T')[0]
      const todaysSyncs = recentLogs.filter((log: any) => 
        log.created_at.startsWith(today) && log.type === 'sync'
      ).length

      const stockChanges = recentLogs.filter((log: any) => 
        log.created_at.startsWith(today) && ['stock_in', 'stock_out'].includes(log.type)
      ).length

      // Sync statistics
      const syncLogs = recentLogs.filter((log: any) => log.type === 'sync')
      const successfulSyncs = syncLogs.filter((log: any) => 
        !log.notes.includes('FAILED') && !log.notes.includes('ERROR')
      ).length
      const failedSyncs = syncLogs.length - successfulSyncs

      setStats({
        totalProducts: allProducts.length,
        connectedStores,
        todaysSyncs,
        stockChanges,
        lowStockItems,
        totalValue,
        activeProducts,
        inactiveProducts,
        recentActivity: recentLogs.slice(0, 5),
        syncStats: {
          successful: successfulSyncs,
          failed: failedSyncs,
          pending: 0
        }
      })
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      const response = await axios.post('/api/products/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data.success) {
        toast.success(`Successfully uploaded ${response.data.count} products`)
        fetchProducts()
        fetchDashboardStats()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleSyncByStore = async () => {
    if (!selectedStore) {
      toast.error('Please select a store first')
      return
    }

    if (filteredProducts.length === 0) {
      toast.error('No products available to sync')
      return
    }

    // Enhanced confirmation dialog
    const storeInfo = stores.find(s => s.id.toString() === selectedStore)
    const confirmMessage = `🔄 SYNC TO SPECIFIC STORE\n\n` +
      `Store: ${storeInfo?.store_name || 'Unknown'}\n` +
      `Products to sync: ${filteredProducts.length}\n` +
      `This will update inventory levels in the selected Shopify store.\n\n` +
      `Are you sure you want to continue?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      setBulkSyncing(true)
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (const product of filteredProducts) {
        try {
          const response = await axios.post('/api/products/sync', {
            productId: product.id,
            storeId: selectedStore
          })
          
          if (response.data.success) {
            successCount++
          } else {
            errorCount++
            errors.push(`${product.sku}: ${response.data.message || 'Unknown error'}`)
          }
        } catch (error: any) {
          errorCount++
          const errorMsg = error.response?.data?.message || error.message || 'Unknown error'
          errors.push(`${product.sku}: ${errorMsg}`)
          console.error(`Failed to sync product ${product.sku}:`, error)
        }
      }

      // Show detailed results
      if (successCount > 0 && errorCount === 0) {
        toast.success(`✅ Successfully synced ${successCount} products to ${storeInfo?.store_name}`)
      } else if (successCount > 0 && errorCount > 0) {
        toast(`⚠️ Partial sync: ${successCount} successful, ${errorCount} failed`, {
          duration: 6000,
          icon: '⚠️'
        })
        console.warn('Sync errors:', errors)
      } else {
        toast.error(`❌ Sync failed: ${errorCount} errors occurred`)
        console.error('All sync errors:', errors)
      }

      setShowStoreSelector(false)
      setSelectedStore('')
      fetchDashboardStats() // Refresh stats after sync
    } catch (error: any) {
      toast.error('Failed to sync products: ' + (error.response?.data?.message || error.message))
    } finally {
      setBulkSyncing(false)
    }
  }

  const handleSyncToAllStores = async () => {
    if (stores.length === 0) {
      toast.error('No connected stores found. Please connect stores in Settings first.')
      return
    }

    if (filteredProducts.length === 0) {
      toast.error('No products available to sync')
      return
    }

    // Enhanced confirmation dialog
    const confirmMessage = `🚀 SYNC TO ALL STORES\n\n` +
      `Connected stores: ${stores.length}\n` +
      `Products to sync: ${filteredProducts.length}\n` +
      `Total operations: ${stores.length * filteredProducts.length}\n\n` +
      `This will update inventory levels across all connected Shopify stores.\n` +
      `This process may take several minutes.\n\n` +
      `Are you sure you want to continue?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      setBulkSyncing(true)
      let totalSuccess = 0
      let totalErrors = 0
      const storeResults: any[] = []

      for (const product of filteredProducts) {
        try {
          const response = await axios.post('/api/products/sync', {
            productId: product.id
            // No storeId means sync to all stores
          })
          
          if (response.data.success && response.data.summary) {
            totalSuccess += response.data.summary.successful
            totalErrors += response.data.summary.failed
            
            // Track per-store results
            if (response.data.results) {
              storeResults.push(...response.data.results)
            }
          } else {
            totalErrors++
          }
        } catch (error: any) {
          totalErrors++
          console.error(`Failed to sync product ${product.sku}:`, error)
        }
      }

      // Show comprehensive results
      if (totalSuccess > 0 && totalErrors === 0) {
        toast.success(`🎉 Successfully synced ${totalSuccess} products across all stores!`)
      } else if (totalSuccess > 0 && totalErrors > 0) {
        toast(`⚠️ Bulk sync completed: ${totalSuccess} successful, ${totalErrors} failed`, {
          duration: 8000,
          icon: '⚠️'
        })
      } else {
        toast.error(`❌ Bulk sync failed: ${totalErrors} errors occurred`)
      }

      fetchDashboardStats() // Refresh stats after sync
    } catch (error: any) {
      toast.error('Failed to sync products to all stores: ' + (error.response?.data?.message || error.message))
    } finally {
      setBulkSyncing(false)
    }
  }

  // Filter products based on search term
  const filteredProducts = products.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Pagination
  const indexOfLastProduct = currentPage * productsPerPage
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage
  const paginatedProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct)
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  return (
    <ProtectedRoute requiredPermission="viewProducts">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Products</h1>
              <p className="text-gray-600">Manage your product inventory and sync with stores</p>
            </div>
            <button
              onClick={() => {
                fetchProducts()
                fetchDashboardStats()
              }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Dashboard Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Total Products */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Products</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalProducts.toLocaleString()}</p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              {/* Connected Stores */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Connected Stores</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.connectedStores}/2</p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Store className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              {/* Today's Syncs */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Today's Syncs</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.todaysSyncs}</p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>

              {/* Stock Changes */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Stock Changes</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.stockChanges}</p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </div>

              {/* Low Stock Items */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.lowStockItems}</p>
                  </div>
                  <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Additional Stats Row */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Inventory Value */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Inventory Value</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalValue)}</p>
                    <p className="text-xs text-gray-500 mt-1">Estimated based on quantity × avg price</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </div>

              {/* Product Status */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Product Status</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">{stats.activeProducts} Active</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium">{stats.inactiveProducts} Inactive</span>
                      </div>
                    </div>
                  </div>
                  <Activity className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              {/* Sync Performance */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Sync Performance</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">{stats.syncStats.successful} Success</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium">{stats.syncStats.failed} Failed</span>
                      </div>
                    </div>
                  </div>
                  <Zap className="h-8 w-8 text-yellow-500" />
                </div>
              </div>
            </div>
          )}

          {/* Upload Section */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Master CSV</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Upload CSV file
                    </span>
                    <span className="mt-1 block text-sm text-gray-500">
                      Supported formats: Product Name/Title, SKU/Variant SKU, Quantity/Variant Inventory Qty, Image/Image Src
                    </span>
                  </label>
                  <input
                    id="csv-upload"
                    name="csv-upload"
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <div className="mt-4">
                    <button
                      onClick={() => document.getElementById('csv-upload')?.click()}
                      disabled={uploading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                          Uploading...
                        </>
                      ) : (
                        'Choose File'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Sync Actions */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Sync by Store */}
                <div className="relative">
                  <button
                    onClick={() => setShowStoreSelector(!showStoreSelector)}
                    disabled={bulkSyncing || stores.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Store className="h-4 w-4" />
                    Sync by Store
                  </button>
                  
                  {showStoreSelector && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-10">
                      <div className="p-4">
                        <h3 className="font-medium text-gray-900 mb-3">Select Store to Sync</h3>
                        <select
                          value={selectedStore}
                          onChange={(e) => setSelectedStore(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 mb-3"
                        >
                          <option value="">Choose a store...</option>
                          {stores.map((store) => (
                            <option key={store.id} value={store.id}>
                              {store.store_name} ({store.store_domain})
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSyncByStore}
                            disabled={!selectedStore || bulkSyncing}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                          >
                            {bulkSyncing ? 'Syncing...' : 'Sync Now'}
                          </button>
                          <button
                            onClick={() => {
                              setShowStoreSelector(false)
                              setSelectedStore('')
                            }}
                            className="px-3 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sync All Stores */}
                <button
                  onClick={handleSyncToAllStores}
                  disabled={bulkSyncing || stores.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${bulkSyncing ? 'animate-spin' : ''}`} />
                  {bulkSyncing ? 'Syncing...' : 'Sync All Stores'}
                </button>

                {stores.length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    No connected stores. <a href="/settings" className="text-blue-600 hover:underline">Connect stores</a> to enable sync.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Products Summary */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {paginatedProducts.length} of {filteredProducts.length} products
                {searchTerm && ` (filtered from ${products.length} total)`}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                Last updated: {formatRelativeTime(new Date().toISOString())}
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
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
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {product.image_url && (
                            <img
                              className="h-10 w-10 rounded-lg object-cover mr-3"
                              src={product.image_url}
                              alt={product.product_name}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {product.product_name}
                            </div>
                            {product.category && (
                              <div className="text-sm text-gray-500">{product.category}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {product.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${
                            product.quantity < 10 ? 'text-red-600' : 
                            product.quantity < 50 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {product.quantity}
                          </span>
                          {product.quantity < 10 && (
                            <AlertTriangle className="h-4 w-4 text-red-500 ml-1" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          product.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              // Individual product sync
                              const confirm = window.confirm(
                                `Sync "${product.product_name}" to all connected stores?`
                              )
                              if (confirm) {
                                axios.post('/api/products/sync', { productId: product.id })
                                  .then(() => {
                                    toast.success(`Synced ${product.product_name}`)
                                    fetchDashboardStats()
                                  })
                                  .catch((error) => {
                                    toast.error(`Failed to sync: ${error.response?.data?.message || error.message}`)
                                  })
                              }
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="Sync to all stores"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              // View product details
                              toast('Product details feature coming soon!', { icon: '🔍' })
                            }}
                            className="text-gray-600 hover:text-gray-900"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
