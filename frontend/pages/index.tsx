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
  needs_sync?: boolean
  last_modified?: string
  last_synced?: string
  sync_status?: string
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
  const [productsNeedingSync, setProductsNeedingSync] = useState<Product[]>([])
  const [syncStats, setSyncStats] = useState<any>(null)
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
  const [showOnlyModified, setShowOnlyModified] = useState(false)

  const { user, isFullyAuthenticated } = useAuth()

  // Add missing functions for product management
  const handleSelectProduct = (productId: number) => {
    const productIdStr = productId.toString()
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productIdStr)) {
      newSelected.delete(productIdStr)
    } else {
      newSelected.add(productIdStr)
    }
    setSelectedProducts(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id.toString())))
    }
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product.id.toString())
    setEditForm({
      product_name: product.product_name,
      category: product.category || '',
      quantity: product.quantity.toString(),
      description: product.description || '',
      image_url: product.image_url || ''
    })
  }

  const handleEditInputChange = (field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveEdit = async (productId: string) => {
    if (!editForm.product_name || !editForm.quantity) {
      toast.error('Product name and quantity are required')
      return
    }

    try {
      const response = await axios.post('/api/products/edit', {
        id: parseInt(productId),
        sku: products.find(p => p.id.toString() === productId)?.sku,
        product_name: editForm.product_name,
        category: editForm.category,
        quantity: parseInt(editForm.quantity),
        description: editForm.description,
        image_url: editForm.image_url
      })

      if (response.data.success) {
        toast.success('Product updated successfully')
        setEditingProduct(null)
        fetchProducts()
        fetchProductsNeedingSync()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update product')
    }
  }

  const handleCancelEdit = () => {
    setEditingProduct(null)
    setEditForm({
      product_name: '',
      category: '',
      quantity: '',
      description: '',
      image_url: ''
    })
  }

  const handleDeleteProduct = async (product: Product) => {
    // Double confirmation for delete action
    const firstConfirm = window.confirm(
      `⚠️ DELETE PRODUCT WARNING ⚠️\n\n` +
      `Are you sure you want to delete this product?\n\n` +
      `Product: ${product.product_name}\n` +
      `SKU: ${product.sku}\n` +
      `Quantity: ${product.quantity}\n\n` +
      `This action cannot be undone!`
    )

    if (!firstConfirm) {
      return
    }

    const secondConfirm = window.confirm(
      `🚨 FINAL CONFIRMATION 🚨\n\n` +
      `This is your FINAL chance to cancel.\n\n` +
      `Deleting "${product.product_name}" will:\n` +
      `• Remove it from inventory\n` +
      `• Delete all associated data\n` +
      `• Cannot be recovered\n\n` +
      `Type "DELETE" in your mind and click OK to proceed.`
    )

    if (!secondConfirm) {
      return
    }

    try {
      const response = await axios.post('/api/products/delete', {
        id: product.id,
        sku: product.sku
      })

      if (response.data.success) {
        toast.success(`Product "${product.product_name}" deleted successfully`)
        fetchProducts()
        fetchProductsNeedingSync()
        fetchDashboardStats()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete product')
    }
  }

  const handleSyncProduct = async (product: Product) => {
    const confirm = window.confirm(
      `🔄 SYNC PRODUCT TO ALL STORES\n\n` +
      `Product: ${product.product_name}\n` +
      `SKU: ${product.sku}\n` +
      `Current Quantity: ${product.quantity}\n\n` +
      `This will sync this product to all connected Shopify stores.\n\n` +
      `Are you sure you want to continue?`
    )

    if (!confirm) {
      return
    }

    try {
      const response = await axios.post('/api/products/sync', {
        productId: product.id,
        sku: product.sku
      })

      if (response.data.success) {
        toast.success(`Successfully synced "${product.product_name}" to all stores`)
        fetchProductsNeedingSync()
        fetchDashboardStats()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to sync product')
    }
  }

  const handleAuditProduct = async (product: Product) => {
    try {
      setLoadingAudit(true)
      const response = await axios.post('/api/products/audit', {
        productId: product.id,
        sku: product.sku
      })

      if (response.data.success) {
        setAuditData(response.data.audit.changes_timeline)
        setShowAuditModal(true)
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to get audit data')
    } finally {
      setLoadingAudit(false)
    }
  }

  const handleSyncSelected = async () => {
    if (selectedProducts.size === 0) {
      toast.error('Please select products to sync')
      return
    }

    setSyncing(true)
    try {
      const selectedSkus = products
        .filter(p => selectedProducts.has(p.id.toString()))
        .map(p => p.sku)

      const response = await axios.post('/api/sync/multi', { skus: selectedSkus })
      toast.success(`Successfully synced ${selectedProducts.size} products`)
      setSelectedProducts(new Set())
      fetchProductsNeedingSync()
      fetchDashboardStats()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to sync selected products')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (isFullyAuthenticated) {
      fetchProducts()
      fetchStores()
      fetchDashboardStats()
      fetchProductsNeedingSync()
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

  const fetchProductsNeedingSync = async () => {
    try {
      const response = await axios.get('/api/products/needs-sync')
      if (response.data.success) {
        setProductsNeedingSync(response.data.products)
        setSyncStats(response.data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch products needing sync:', error)
    }
  }

  const fetchDashboardStats = async () => {
    try {
      // Fetch comprehensive dashboard statistics
      const [productsRes, storesRes, stockLogsRes, syncStatsRes] = await Promise.all([
        axios.get('/api/products'),
        axios.get('/api/stores'),
        axios.get('/api/stock-logs?limit=10'),
        axios.get('/api/dashboard/sync-stats').catch(() => ({ data: { today: { total_syncs: 0, stock_changes: 0 } } }))
      ])

      const allProducts = productsRes.data || []
      const allStores = storesRes.data || []
      const recentLogs = stockLogsRes.data.stockLogs || []
      const syncStats = syncStatsRes.data || { today: { total_syncs: 0, stock_changes: 0 } }

      // Calculate statistics
      const activeProducts = allProducts.filter((p: Product) => p.is_active).length
      const inactiveProducts = allProducts.filter((p: Product) => !p.is_active).length
      const connectedStores = allStores.filter((s: any) => s.connected).length
      const lowStockItems = allProducts.filter((p: Product) => p.quantity < 10).length
      
      // Calculate total inventory value (assuming average price of ₹10 if no price)
      const totalValue = allProducts.reduce((sum: number, p: Product) => {
        const price = parseFloat(p.price) || 10
        return sum + (price * p.quantity)
      }, 0)

      // Use API data for today's activities (more accurate)
      const todaysSyncs = syncStats.today?.total_syncs || 0
      const stockChanges = syncStats.today?.stock_changes || 0

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

    // Always sync only modified products to save time
    const productsToSync = productsNeedingSync
    
    if (productsToSync.length === 0) {
      toast.success('🎉 All products are already up to date! No sync needed.')
      return
    }

    // Enhanced confirmation dialog
    const storeInfo = stores.find(s => s.id.toString() === selectedStore)
    const modifiedCount = productsNeedingSync.length
    const totalCount = filteredProducts.length
    
    const confirmMessage = `🔄 SYNC TO SPECIFIC STORE\n\n` +
      `Store: ${storeInfo?.store_name || 'Unknown'}\n` +
      `Products to sync: ${productsToSync.length} (modified products only)\n` +
      `Modified: ${modifiedCount} | Up to date: ${totalCount - modifiedCount}\n\n` +
      `This will update inventory levels in the selected Shopify store.\n` +
      `✅ Smart sync enabled - only syncing products that need updates!\n\n` +
      `Are you sure you want to continue?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      setBulkSyncing(true)
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (const product of productsToSync) {
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
      fetchProductsNeedingSync() // Refresh sync status
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

    // Always sync only modified products to save time
    const productsToSync = productsNeedingSync
    
    if (productsToSync.length === 0) {
      toast.success('🎉 All products are already up to date! No sync needed.')
      return
    }

    // Enhanced confirmation dialog
    const modifiedCount = productsNeedingSync.length
    const totalCount = filteredProducts.length
    const totalOperations = stores.length * productsToSync.length
    
    const confirmMessage = `🚀 SYNC TO ALL STORES\n\n` +
      `Connected stores: ${stores.length}\n` +
      `Products to sync: ${productsToSync.length} (modified products only)\n` +
      `Modified: ${modifiedCount} | Up to date: ${totalCount - modifiedCount}\n` +
      `Total operations: ${totalOperations}\n\n` +
      `This will update inventory levels across all connected Shopify stores.\n` +
      `✅ Smart sync enabled - only syncing products that need updates!\n` +
      `Estimated time: ${Math.ceil(totalOperations / 10)} seconds\n\n` +
      `Are you sure you want to continue?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      setBulkSyncing(true)
      let totalSuccess = 0
      let totalErrors = 0
      const storeResults: any[] = []

      for (const product of productsToSync) {
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
      fetchProductsNeedingSync() // Refresh sync status
    } catch (error: any) {
      toast.error('Failed to sync products to all stores: ' + (error.response?.data?.message || error.message))
    } finally {
      setBulkSyncing(false)
    }
  }

  // Filter products based on search term and sync status
  const baseProducts = showOnlyModified ? productsNeedingSync : products
  const filteredProducts = baseProducts.filter(product =>
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
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
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

          {/* Sync Status Row */}
          {syncStats && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Sync Status</h3>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showOnlyModified}
                    onChange={(e) => setShowOnlyModified(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Show only modified products</span>
                </label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{syncStats.total_products}</div>
                  <div className="text-sm text-gray-600">Total Products</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{syncStats.needs_sync_count}</div>
                  <div className="text-sm text-gray-600">Need Sync</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{syncStats.never_synced_count}</div>
                  <div className="text-sm text-gray-600">Never Synced</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{syncStats.up_to_date_count}</div>
                  <div className="text-sm text-gray-600">Up to Date</div>
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
                {selectedProducts.size > 0 && (
                  <button
                    onClick={handleSyncSelected}
                    disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {syncing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Sync Selected ({selectedProducts.size})
                  </button>
                )}
                
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
                      <button
                        onClick={handleSelectAll}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {selectedProducts.size === filteredProducts.length && filteredProducts.length > 0 ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
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
                      Sync Status
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
                        <button
                          onClick={() => handleSelectProduct(product.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {selectedProducts.has(product.id.toString()) ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        {editingProduct === product.id.toString() ? (
                          <input
                            type="text"
                            value={editForm.product_name}
                            onChange={(e) => handleEditInputChange('product_name', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
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
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {product.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingProduct === product.id.toString() ? (
                          <input
                            type="number"
                            value={editForm.quantity}
                            onChange={(e) => handleEditInputChange('quantity', e.target.value)}
                            min="0"
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
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
                        )}
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {product.needs_sync ? (
                            <>
                              <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
                              <span className="text-xs text-orange-600 font-medium">
                                {product.last_synced ? 'Modified' : 'Never synced'}
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-green-600 font-medium">Up to date</span>
                            </>
                          )}
                        </div>
                        {product.last_synced && (
                          <div className="text-xs text-gray-500 mt-1">
                            Last synced: {formatRelativeTime(product.last_synced)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-1 flex-wrap">
                          {editingProduct === product.id.toString() ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(product.id.toString())}
                                className="text-green-600 hover:text-green-900 flex items-center gap-1"
                              >
                                <Save className="h-4 w-4" />
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
                              >
                                <X className="h-4 w-4" />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditProduct(product)}
                                className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                                title="Edit product details"
                              >
                                <Edit className="h-4 w-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product)}
                                className="text-red-600 hover:text-red-900 flex items-center gap-1"
                                title="Delete product"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                              <button
                                onClick={() => handleSyncProduct(product)}
                                className="text-green-600 hover:text-green-900 flex items-center gap-1"
                                title="Sync product to all stores"
                              >
                                <RotateCw className="h-4 w-4" />
                                Sync
                              </button>
                              <button
                                onClick={() => handleAuditProduct(product)}
                                disabled={loadingAudit}
                                className="text-purple-600 hover:text-purple-900 flex items-center gap-1 disabled:opacity-50"
                                title="View product audit history"
                              >
                                {loadingAudit ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FileText className="h-4 w-4" />
                                )}
                                Audit
                              </button>
                            </>
                          )}
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

          {/* Audit Modal */}
          {showAuditModal && auditData && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Product Audit History</h3>
                    <button
                      onClick={() => setShowAuditModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="space-y-4">
                      {auditData.map((audit: any, index: number) => (
                        <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">
                              {audit.change_type}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatRelativeTime(audit.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{audit.description}</p>
                          {audit.notes && (
                            <p className="text-xs text-gray-500 mt-1 italic">
                              Note: {audit.notes}
                            </p>
                          )}
                          {audit.performed_by && (
                            <p className="text-xs text-gray-500 mt-1">
                              by {audit.performed_by}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
