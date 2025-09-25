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
  totalStores: number
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

interface SyncDetail {
  product_name: string
  sku: string
  status: 'success' | 'failed'
  message: string
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
  
  // Debug panel state
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  
  // Sync progress tracking
  const [syncProgress, setSyncProgress] = useState({
    isActive: false,
    current: 0,
    total: 0,
    message: '',
    storeName: '',
    stage: 'preparing' // preparing, syncing, completed
  })
  
  // Sync completion report
  const [syncReport, setSyncReport] = useState({
    show: false,
    results: {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[],
      details: [] as SyncDetail[]
    }
  })
  const [debugResults, setDebugResults] = useState<any>(null)
  const [debugLoading, setDebugLoading] = useState(false)

  const { user, isFullyAuthenticated } = useAuth()

  // Debug functions
  const runDebugCommand = async (commandName: string, apiCall: () => Promise<any>) => {
    setDebugLoading(true)
    try {
      const result = await apiCall()
      setDebugResults((prev: any) => ({
        ...prev,
        [commandName]: result
      }))
      toast.success(`✅ ${commandName} completed`)
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message
      setDebugResults((prev: any) => ({
        ...prev,
        [commandName]: { error: errorMsg }
      }))
      toast.error(`❌ ${commandName} failed: ${errorMsg}`)
    } finally {
      setDebugLoading(false)
    }
  }

  const checkDatabaseSchema = () => {
    runDebugCommand('Database Schema Check', async () => {
      const response = await axios.get('/api/debug/database-schema')
      return response.data
    })
  }

  const fixDatabaseSchema = () => {
    runDebugCommand('Fix Database Schema', async () => {
      const response = await axios.post('/api/products/add-sync-columns')
      return response.data
    })
  }

  const markSKUForSync = () => {
    runDebugCommand('Mark SKU for Sync', async () => {
      const response = await axios.post('/api/products/mark-sku-needs-sync', {
        sku: '5G238FMG7385-C1'
      })
      return response.data
    })
  }

  const verifySync = () => {
    runDebugCommand('Verify Sync Status', async () => {
      const response = await axios.get('/api/products/needs-sync')
      return response.data
    })
  }

  const refreshPage = () => {
    window.location.reload()
  }

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
      const response = await axios.get(`/api/products/audit-report?productId=${product.id}`)

      if (response.data.success) {
        setAuditData(response.data.auditReport)
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

    // Initialize sync progress
    setSyncProgress({
      isActive: true,
      current: 0,
      total: selectedProducts.size,
      message: 'Preparing sync...',
      storeName: 'All Stores',
      stage: 'preparing'
    })

    setSyncing(true)
    try {
      const selectedProductIds = Array.from(selectedProducts).map(id => parseInt(id))

      // Update progress
      setSyncProgress(prev => ({
        ...prev,
        stage: 'syncing',
        message: `Syncing ${selectedProducts.size} products...`
      }))

      // Use optimized sync API for better handling of large syncs
      const response = await axios.post('/api/sync/bulk-optimized', { 
        productIds: selectedProductIds,
        syncAll: true,
        batchSize: 10
      }, {
        timeout: 300000 // 5 minute timeout
      })
      
      if (response.data.success) {
        const { summary } = response.data
        
        // Show completion report
        setSyncReport({
          show: true,
          results: {
            total: summary.total || selectedProducts.size,
            successful: summary.successful || 0,
            failed: summary.failed || 0,
            errors: response.data.errors || [],
            details: response.data.details || []
          }
        })
        
        setSyncProgress(prev => ({
          ...prev,
          stage: 'completed',
          message: 'Sync completed successfully!',
          current: prev.total
        }))
        
        if (summary.failed === 0) {
          toast.success(`Successfully synced ${selectedProducts.size} products to all stores`)
        } else if (summary.successful > 0) {
          toast.success(`Partial sync: ${summary.successful} successful, ${summary.failed} failed`)
        } else {
          toast.error(`Failed to sync selected products: ${summary.failed} failed`)
        }
      } else {
        setSyncProgress(prev => ({
          ...prev,
          stage: 'completed',
          message: 'Sync failed',
          current: prev.total
        }))
        toast.error(response.data.message || 'Failed to sync selected products')
      }
      
      setSelectedProducts(new Set())
      fetchProductsNeedingSync()
      fetchDashboardStats()
    } catch (error: any) {
      console.error('Sync selected error:', error)
      setSyncProgress(prev => ({
        ...prev,
        stage: 'completed',
        message: 'Sync failed with error',
        current: prev.total
      }))
      toast.error(error.response?.data?.message || 'Failed to sync selected products')
    } finally {
      setSyncing(false)
      // Reset progress after a delay
      setTimeout(() => {
        setSyncProgress({
          isActive: false,
          current: 0,
          total: 0,
          message: '',
          storeName: '',
          stage: 'preparing'
        })
      }, 3000)
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
      const totalStores = allStores.length
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
        totalStores,
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
    
    const confirmMessage = `🔄 SMART SYNC TO SPECIFIC STORE\n\n` +
      `Store: ${storeInfo?.store_name || 'Unknown'}\n` +
      `⚡ Smart Mode: Only syncing ${productsToSync.length} modified products\n` +
      `💰 Cost Savings: Skipping ${totalCount - modifiedCount} up-to-date products\n\n` +
      `This will update inventory levels in the selected Shopify store.\n` +
      `Smart Sync saves time & API costs by only syncing what's changed!\n\n` +
      `Continue with smart sync?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      setBulkSyncing(true)
      
      const response = await axios.post('/api/sync/bulk-optimized', {
        storeId: selectedStore,
        syncAll: false,
        productIds: productsToSync.map(p => p.id),
        batchSize: 10
      }, {
        timeout: 300000 // 5 minute timeout
      })
      
      if (response.data.success) {
        const { summary, message } = response.data
        
        if (summary.failed === 0) {
          toast.success(`🎉 Successfully synced ${summary.successful} products to ${storeInfo?.store_name}!`)
        } else if (summary.successful > 0) {
          toast.success(`✅ Partial sync: ${summary.successful} successful, ${summary.failed} failed`)
        } else {
          toast.error(`❌ Failed to sync products to ${storeInfo?.store_name}`)
        }
      } else {
        toast.error(response.data.message || 'Failed to sync products')
      }

      setShowStoreSelector(false)
      setSelectedStore('')
      fetchDashboardStats() // Refresh stats after sync
      fetchProductsNeedingSync() // Refresh sync status
    } catch (error: any) {
      console.error('Sync by store error:', error)
      toast.error('Failed to sync products: ' + (error.response?.data?.message || error.message))
    } finally {
      setBulkSyncing(false)
    }
  }

  const handleMarkAllUpToDate = async () => {
    try {
      const confirmed = confirm(
        'This will mark ALL products as up-to-date for sync. Use this after uploading a master CSV file.\n\n' +
        'This means only products that are modified AFTER this action will show as needing sync.\n\n' +
        'Are you sure you want to continue?'
      )
      
      if (!confirmed) return

      toast.loading('Marking all products as up-to-date...', { id: 'mark-up-to-date' })

      const token = localStorage.getItem('token')
      const response = await axios.post('/api/products/mark-all-up-to-date', {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000
      })

      if (response.data.success) {
        toast.success(`Successfully marked ${response.data.updatedCount} products as up-to-date!`, { id: 'mark-up-to-date' })
        
        // Refresh the products list to show updated sync status
        await fetchProducts()
      } else {
        toast.error(response.data.message || 'Failed to mark products as up-to-date', { id: 'mark-up-to-date' })
      }
    } catch (error: any) {
      console.error('Error marking products as up-to-date:', error)
      toast.error('Failed to mark products as up-to-date: ' + (error.response?.data?.message || error.message), { id: 'mark-up-to-date' })
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
    
    const confirmMessage = `🚀 SMART SYNC TO ALL STORES\n\n` +
      `Connected stores: ${stores.length}\n` +
      `⚡ Smart Mode: Only syncing ${productsToSync.length} modified products\n` +
      `💰 Cost Savings: Skipping ${totalCount - modifiedCount} up-to-date products\n` +
      `Total operations: ${totalOperations}\n\n` +
      `This will update inventory levels across all connected Shopify stores.\n` +
      `Smart Sync saves time & API costs by only syncing what's changed!\n` +
      `Estimated time: ${Math.ceil(totalOperations / 10)} seconds\n\n` +
      `Continue with smart sync?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      setBulkSyncing(true)
      
      const response = await axios.post('/api/sync/bulk-optimized', {
        syncAll: true,
        productIds: productsToSync.map(p => p.id),
        batchSize: 10
      }, {
        timeout: 300000 // 5 minute timeout
      })
      
      if (response.data.success) {
        const { summary, message } = response.data
        
        if (summary.failed === 0) {
          toast.success(`🎉 Successfully synced ${summary.successful} products across all stores!`)
        } else if (summary.successful > 0) {
          toast.success(`✅ Partial sync: ${summary.successful} successful, ${summary.failed} failed`)
        } else {
          toast.error(`❌ Failed to sync products to all stores`)
        }
      } else {
        toast.error(response.data.message || 'Failed to sync products')
      }

      fetchDashboardStats() // Refresh stats after sync
      fetchProductsNeedingSync() // Refresh sync status
    } catch (error: any) {
      console.error('Sync to all stores error:', error)
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

  // Debug logging
  useEffect(() => {
    console.log('🔍 Sync Debug Info:', {
      showOnlyModified,
      totalProducts: products.length,
      productsNeedingSync: productsNeedingSync.length,
      baseProducts: baseProducts.length,
      filteredProducts: filteredProducts.length,
      syncStats
    })
  }, [showOnlyModified, products.length, productsNeedingSync.length, baseProducts.length, filteredProducts.length])

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
            <div className="flex gap-2">
              <button
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Zap className="h-4 w-4" />
                Debug Sync
              </button>
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
          </div>

          {/* Debug Panel */}
          {showDebugPanel && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-yellow-800">🔧 Sync Debug Panel</h2>
                <button
                  onClick={() => setShowDebugPanel(false)}
                  className="text-yellow-600 hover:text-yellow-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                <button
                  onClick={checkDatabaseSchema}
                  disabled={debugLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  1. Check Schema
                </button>
                <button
                  onClick={fixDatabaseSchema}
                  disabled={debugLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  2. Fix Schema
                </button>
                <button
                  onClick={markSKUForSync}
                  disabled={debugLoading}
                  className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                >
                  3. Mark SKU
                </button>
                <button
                  onClick={verifySync}
                  disabled={debugLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  4. Verify
                </button>
                <button
                  onClick={refreshPage}
                  disabled={debugLoading}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  5. Refresh
                </button>
              </div>

              {debugLoading && (
                <div className="flex items-center gap-2 text-blue-600 mb-4">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running debug command...
                </div>
              )}

              {debugResults && (
                <div className="bg-white rounded border p-4 max-h-96 overflow-y-auto">
                  <h3 className="font-semibold mb-2">Debug Results:</h3>
                  <pre className="text-sm bg-gray-100 p-3 rounded overflow-x-auto">
                    {JSON.stringify(debugResults, null, 2)}
                  </pre>
                </div>
              )}

              <div className="mt-4 text-sm text-yellow-700">
                <p><strong>Instructions:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click "1. Check Schema" to see database structure</li>
                  <li>Click "2. Fix Schema" to add missing columns and reset sync status</li>
                  <li>Click "3. Mark SKU" to mark only your modified SKU (5G238FMG7385-C1)</li>
                  <li>Click "4. Verify" to check how many products need sync (should be 1)</li>
                  <li>Click "5. Refresh" to reload the page and test sync functionality</li>
                </ol>
              </div>
            </div>
          )}

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
                    <p className="text-2xl font-bold text-gray-900">{stats.connectedStores}/{stats.totalStores}</p>
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
          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <div className="flex flex-col gap-4">
              {/* Search Section */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {showOnlyModified && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                      🔍 Showing only modified products ({productsNeedingSync.length})
                    </span>
                    <button
                      onClick={() => setShowOnlyModified(false)}
                      className="text-xs text-orange-600 hover:text-orange-800 underline"
                    >
                      Clear filter
                    </button>
                  </div>
                )}
              </div>
              
              {/* Action Buttons - Mobile First */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {selectedProducts.size > 0 && (
                  <button
                    onClick={handleSyncSelected}
                    disabled={syncing}
                    className="flex items-center justify-center gap-2 px-3 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {syncing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Sync Selected</span>
                    <span className="sm:hidden">Sync ({selectedProducts.size})</span>
                  </button>
                )}
                
                {/* Sync by Store */}
                <div className="relative">
                  <button
                    onClick={() => setShowStoreSelector(!showStoreSelector)}
                    disabled={bulkSyncing || stores.length === 0}
                    className="flex items-center justify-center gap-2 px-3 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium w-full"
                  >
                    <Store className="h-4 w-4" />
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">Sync by Store</span>
                      <span className="text-xs opacity-90 hidden sm:block">
                        ⚡ Smart: {productsNeedingSync.length} modified
                      </span>
                    </div>
                  </button>
                  
                  {showStoreSelector && (
                    <div className="absolute right-0 mt-2 w-full sm:w-64 bg-white rounded-lg shadow-lg border z-10">
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
                  className="flex items-center justify-center gap-2 px-3 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium w-full"
                >
                  <RefreshCw className={`h-4 w-4 ${bulkSyncing ? 'animate-spin' : ''}`} />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">
                      {bulkSyncing ? 'Syncing...' : 'Sync All Stores'}
                    </span>
                    {!bulkSyncing && (
                      <span className="text-xs opacity-90 hidden sm:block">
                        ⚡ Smart: {productsNeedingSync.length} modified
                      </span>
                    )}
                  </div>
                </button>

                {/* Mark All Up-to-Date Button */}
                <button
                  onClick={handleMarkAllUpToDate}
                  className="flex items-center justify-center gap-2 px-3 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium w-full"
                >
                  <CheckCircle className="h-4 w-4" />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">Mark All Up-to-Date</span>
                    <span className="text-xs opacity-90 hidden sm:block">
                      📋 After master CSV upload
                    </span>
                  </div>
                </button>

                {/* Show Only Modified Button */}
                <button
                  onClick={() => setShowOnlyModified(!showOnlyModified)}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg transition-colors text-sm font-medium w-full ${
                    showOnlyModified 
                      ? 'bg-orange-600 text-white hover:bg-orange-700' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">
                      {showOnlyModified ? 'Show All Products' : 'Show Modified Only'}
                    </span>
                    <span className="text-xs opacity-90 hidden sm:block">
                      {showOnlyModified 
                        ? `👁️ Showing ${productsNeedingSync.length} modified` 
                        : `🔍 Filter modified products`
                      }
                    </span>
                  </div>
                </button>

                {stores.length === 0 && (
                  <div className="col-span-full">
                    <p className="text-sm text-gray-500 italic">
                      No connected stores. <a href="/settings" className="text-blue-600 hover:underline">Connect stores</a> to enable sync.
                    </p>
                  </div>
                )}

              </div>
              
              {/* Smart Sync Info */}
              {stores.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                  <Zap className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span className="break-words">
                    <strong>Smart Sync:</strong> {showOnlyModified 
                      ? `Showing ${productsNeedingSync.length} modified products that need sync`
                      : `Only syncs ${productsNeedingSync.length} modified products${productsNeedingSync.length === 0 ? ' (all up to date!)' : ` out of ${products.length} total`}${productsNeedingSync.length > 0 && ' - saves time & API costs!'}`
                    }
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Products Summary */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-sm text-gray-600">
                Showing {paginatedProducts.length} of {filteredProducts.length} products
                {showOnlyModified && ` (modified only)`}
                {searchTerm && ` (filtered from ${showOnlyModified ? productsNeedingSync.length : products.length} total)`}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Last updated: {formatRelativeTime(new Date().toISOString())}</span>
                <span className="sm:hidden">{formatRelativeTime(new Date().toISOString())}</span>
              </div>
            </div>
          </div>

          {/* Products Grid - Single Panel Layout */}
          <div className="bg-white rounded-lg shadow-sm border">
            {/* Select All Header */}
            <div className="bg-gray-50 px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
                >
                  {selectedProducts.size === filteredProducts.length && filteredProducts.length > 0 ? (
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium">
                    Select All ({selectedProducts.size}/{filteredProducts.length})
                  </span>
                </button>
                {selectedProducts.size > 0 && (
                  <span className="text-xs text-blue-600 font-medium">
                    {selectedProducts.size} selected
                  </span>
                )}
              </div>
            </div>

            {/* Products Grid */}
            <div className="divide-y divide-gray-200">
              {paginatedProducts.map((product) => (
                <div key={product.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Selection Checkbox */}
                    <div className="flex-shrink-0 pt-1">
                      <button
                        onClick={() => handleSelectProduct(product.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {selectedProducts.has(product.id.toString()) ? (
                          <CheckSquare className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </div>

                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      {product.image_url && (
                        <img
                          className="h-16 w-16 rounded-lg object-cover border border-gray-200"
                          src={product.image_url}
                          alt={product.product_name}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        {/* Left Column - Product Info */}
                        <div className="flex-1 min-w-0">
                          {editingProduct === product.id.toString() ? (
                            <input
                              type="text"
                              value={editForm.product_name}
                              onChange={(e) => handleEditInputChange('product_name', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                            />
                          ) : (
                            <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
                              {product.product_name}
                            </h3>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded">{product.sku}</span>
                            {product.category && (
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {product.category}
                              </span>
                            )}
                          </div>

                          {/* Quantity and Status Row */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Quantity:</span>
                              {editingProduct === product.id.toString() ? (
                                <input
                                  type="number"
                                  value={editForm.quantity}
                                  onChange={(e) => handleEditInputChange('quantity', e.target.value)}
                                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              ) : (
                                <span className={`text-sm font-semibold ${
                                  product.quantity < 10 ? 'text-red-600' : 
                                  product.quantity < 50 ? 'text-yellow-600' : 'text-green-600'
                                }`}>
                                  {product.quantity}
                                  {product.quantity < 10 && <AlertTriangle className="h-3 w-3 text-red-500 ml-1 inline" />}
                                </span>
                              )}
                            </div>

                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              product.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {product.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>

                        {/* Right Column - Sync Status and Actions */}
                        <div className="flex flex-col items-end gap-2">
                          {/* Sync Status */}
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
                            <div className="text-xs text-gray-500">
                              Last synced: {formatRelativeTime(product.last_synced)}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1">
                            {editingProduct === product.id.toString() ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(product.id.toString())}
                                  className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                                  title="Save changes"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50"
                                  title="Cancel editing"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEditProduct(product)}
                                  className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                                  title="Edit product"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product)}
                                  className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                                  title="Delete product"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleSyncProduct(product)}
                                  className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                                  title="Sync product"
                                >
                                  <RotateCw className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleAuditProduct(product)}
                                  disabled={loadingAudit}
                                  className="text-purple-600 hover:text-purple-900 p-1 rounded hover:bg-purple-50 disabled:opacity-50"
                                  title="View audit history"
                                >
                                  {loadingAudit ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <FileText className="h-4 w-4" />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50 hover:bg-gray-50"
                  >
                    <span className="hidden sm:inline">Previous</span>
                    <span className="sm:hidden">←</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50 hover:bg-gray-50"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <span className="sm:hidden">→</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Audit Modal */}
          {showAuditModal && auditData && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col">
                {/* Fixed Header */}
                <div className="flex items-center justify-between mb-4 border-b pb-4 flex-shrink-0">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Product Audit History</h3>
                    <p className="text-sm text-gray-600 mt-1">Comprehensive tracking of all product changes and CSV uploads</p>
                  </div>
                  <button
                    onClick={() => setShowAuditModal(false)}
                    className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {/* Statistics Summary */}
                  {auditData.statistics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{auditData.statistics.quantity?.totalChanges || 0}</div>
                        <div className="text-xs text-gray-600">Total Changes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{auditData.statistics.csv?.totalCsvUploads || 0}</div>
                        <div className="text-xs text-gray-600">CSV Uploads</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{auditData.statistics.sync?.totalSyncs || 0}</div>
                        <div className="text-xs text-gray-600">Sync Operations</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{auditData.statistics.scan?.totalScans || 0}</div>
                        <div className="text-xs text-gray-600">Scans</div>
                      </div>
                    </div>
                  )}

                  {/* Tabs for different views */}
                  <div className="flex space-x-1 mb-4 border-b">
                    <button className="px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                      Complete Timeline
                    </button>
                    <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
                      CSV Uploads
                    </button>
                    <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
                      Sync History
                    </button>
                  </div>

                  {/* Audit Timeline */}
                  <div className="pb-4">
                    <div className="space-y-4">
                      {auditData.auditTimeline?.map((audit: any, index: number) => (
                        <div key={index} className="relative">
                          {/* Timeline line */}
                          {index < auditData.auditTimeline.length - 1 && (
                            <div className="absolute left-4 top-8 w-0.5 h-full bg-gray-200"></div>
                          )}
                          
                          <div className="flex items-start space-x-4">
                            {/* Event icon */}
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              {audit.event_type === 'stock_in' ? (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              ) : audit.event_type === 'stock_out' ? (
                                <TrendingDown className="h-4 w-4 text-red-600" />
                              ) : audit.event_type === 'sync' ? (
                                <RefreshCw className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Package className="h-4 w-4 text-gray-600" />
                              )}
                            </div>

                            {/* Event content */}
                            <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-semibold text-gray-900">
                                    {audit.event_type === 'stock_in' ? 'Stock Added' : 
                                     audit.event_type === 'stock_out' ? 'Stock Removed' :
                                     audit.event_type === 'sync' ? 'Sync Operation' : 'Other'}
                                  </span>
                                  {audit.is_bulk_operation && (
                                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                      CSV Upload
                                    </span>
                                  )}
                                  {audit.is_consolidated && (
                                    <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                                      Consolidated
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {formatRelativeTime(audit.created_at)}
                                </span>
                              </div>

                              {/* Quantity change */}
                              {audit.quantity && (
                                <div className="text-sm text-gray-700 mb-2">
                                  <strong>Quantity:</strong> {audit.quantity} units
                                </div>
                              )}

                              {/* CSV file details */}
                              {audit.csv_filename && (
                                <div className="text-sm text-blue-700 mb-2 p-2 bg-blue-50 rounded">
                                  <strong>📁 CSV File:</strong> {audit.csv_filename}
                                  {audit.consolidation_count && (
                                    <span className="ml-2 text-orange-600">
                                      ({audit.consolidation_count} entries consolidated)
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Notes */}
                              {audit.notes && (
                                <div className="text-sm text-gray-600 mb-2">
                                  <strong>Details:</strong> {audit.notes}
                                </div>
                              )}

                              {/* Performed by */}
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>Performed by: <strong>{audit.user_name || 'System'}</strong></span>
                                <span>{new Date(audit.created_at).toLocaleString()}</span>
                              </div>

                              {/* Sync status for sync operations */}
                              {audit.event_type === 'sync' && audit.sync_status && (
                                <div className="mt-2">
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    audit.sync_status === 'success' ? 'bg-green-100 text-green-800' :
                                    audit.sync_status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {audit.sync_status.toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* CSV Sessions Summary */}
                      {auditData.csvSessions && auditData.csvSessions.length > 0 && (
                        <div className="mt-8">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">📊 CSV Upload Sessions</h4>
                          <div className="space-y-3">
                            {auditData.csvSessions.map((session: any, index: number) => (
                              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                    <span className="font-medium text-gray-900">
                                      {session.csv_filename || 'Unknown File'}
                                    </span>
                                    {session.has_consolidation && (
                                      <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                                        Consolidated
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-sm text-gray-500">
                                    {new Date(session.session_start).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-600">Type:</span>
                                    <span className="ml-1 font-medium">{session.upload_type}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Changes:</span>
                                    <span className="ml-1 font-medium">{session.total_changes}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Stock In:</span>
                                    <span className="ml-1 font-medium text-green-600">{session.total_stock_in}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Stock Out:</span>
                                    <span className="ml-1 font-medium text-red-600">{session.total_stock_out}</span>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                  Session: {new Date(session.session_start).toLocaleString()} - {new Date(session.session_end).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sync Progress Bar */}
        {syncProgress.isActive && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  {syncProgress.stage === 'preparing' && <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />}
                  {syncProgress.stage === 'syncing' && <RefreshCw className="h-8 w-8 animate-spin text-green-500" />}
                  {syncProgress.stage === 'completed' && (
                    syncProgress.message.includes('failed') ? 
                      <XCircle className="h-8 w-8 text-red-500" /> : 
                      <CheckCircle className="h-8 w-8 text-green-500" />
                  )}
                </div>
                
                <h3 className="text-lg font-semibold mb-2">
                  {syncProgress.stage === 'preparing' && 'Preparing Sync'}
                  {syncProgress.stage === 'syncing' && 'Syncing Products'}
                  {syncProgress.stage === 'completed' && 'Sync Complete'}
                </h3>
                
                <p className="text-gray-600 mb-4">{syncProgress.message}</p>
                
                {syncProgress.stage === 'syncing' && (
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                    ></div>
                  </div>
                )}
                
                <p className="text-sm text-gray-500">
                  {syncProgress.stage === 'syncing' && `${syncProgress.current} of ${syncProgress.total} products`}
                  {syncProgress.stage === 'preparing' && 'Initializing...'}
                  {syncProgress.stage === 'completed' && 'Processing complete'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sync Completion Report Modal */}
        {syncReport.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">Sync Report</h3>
                <button
                  onClick={() => setSyncReport({ show: false, results: { total: 0, successful: 0, failed: 0, errors: [], details: [] } })}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{syncReport.results.total}</div>
                  <div className="text-sm text-blue-600">Total Products</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{syncReport.results.successful}</div>
                  <div className="text-sm text-green-600">Successful</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{syncReport.results.failed}</div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
              </div>

              {/* Success Rate */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Success Rate</span>
                  <span className="text-sm font-medium text-gray-700">
                    {syncReport.results.total > 0 ? Math.round((syncReport.results.successful / syncReport.results.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${syncReport.results.total > 0 ? (syncReport.results.successful / syncReport.results.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Error Details */}
              {syncReport.results.errors.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 text-red-600">Errors ({syncReport.results.errors.length})</h4>
                  <div className="bg-red-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                    {syncReport.results.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-700 mb-1">
                        • {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Results */}
              {syncReport.results.details.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-3">Detailed Results</h4>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <div className="space-y-2">
                      {syncReport.results.details.map((detail, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{detail.product_name || detail.sku}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            detail.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {detail.status === 'success' ? 'Success' : 'Failed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setSyncReport({ show: false, results: { total: 0, successful: 0, failed: 0, errors: [], details: [] } })}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  )
}
