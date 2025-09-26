import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { 
  RefreshCw, 
  Package, 
  Store,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Eye,
  TrendingUp,
  TrendingDown,
  FileText,
  Search,
  Filter,
  ChevronDown,
  ChevronUp
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

interface Store {
  id: number
  store_name: string
  store_domain: string
  connected: boolean
  stats?: {
    total_products_synced: number
    successful_syncs: number
    failed_syncs: number
    last_sync_activity: string
    recent_activity_count: number
    sync_success_rate: number
  }
}

interface Variant {
  variantId: string
  variantTitle: string
  inventoryItemId: string
  quantity: number
  locationId: string
}

interface ShopifyQuantity {
  quantity: number
  store_name: string
  variants: Variant[]
  variant_count: number
  found: boolean
  error?: string
}

interface InventoryComparison {
  product: Product
  local_quantity: number
  shopify_quantities: Record<string, ShopifyQuantity>
  total_shopify_quantity: number
  total_variants_found: number
  difference: number
  status: 'in_sync' | 'local_higher' | 'shopify_higher' | 'not_found'
}

export default function ShopifyInventoryComparison() {
  const [comparisons, setComparisons] = useState<InventoryComparison[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterStore, setFilterStore] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('smart')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(25)
  const [pagination, setPagination] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set())
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [auditData, setAuditData] = useState<any>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [syncProgress, setSyncProgress] = useState({
    isVisible: false,
    current: 0,
    total: 0,
    message: '',
    successCount: 0,
    errorCount: 0
  })
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [syncReport, setSyncReport] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)

  const { user, isFullyAuthenticated } = useAuth()

  useEffect(() => {
    if (isFullyAuthenticated) {
      fetchInventoryComparison()
      fetchStores()
      fetchCategories()
    }
  }, [isFullyAuthenticated, currentPage, searchTerm, filterStatus, filterStore, filterCategory, sortBy, sortOrder])

  const fetchInventoryComparison = async () => {
    try {
      setLoading(true)
      console.log('Fetching inventory comparison...')
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm,
        status: filterStatus,
        store: filterStore,
        category: filterCategory,
        sortBy: sortBy,
        sortOrder: sortOrder
      })

      const response = await axios.get(`/api/inventory/comparison-v2?${params}`)
      console.log('Inventory comparison response:', response.data)

      if (response.data.success) {
        setComparisons(response.data.comparisons)
        setPagination(response.data.pagination)
        setStats(response.data.stats)
        setStores(response.data.stores)
      }
    } catch (error: any) {
      console.error('Error fetching inventory comparison:', error)
      toast.error('Failed to fetch inventory comparison')
    } finally {
      setLoading(false)
    }
  }

  const fetchStores = async () => {
    try {
      const response = await axios.get('/api/stores')
      if (response.data.success) {
        setStores(response.data.stores)
      }
    } catch (error) {
      console.error('Error fetching stores:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/products/categories')
      if (response.data.success) {
        setCategories(response.data.categories)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const syncProductToShopify = async (product: Product) => {
    console.log('Syncing product:', product)
    
    const confirm = window.confirm(
      `🔄 SYNC ALL VARIANTS TO SHOPIFY\n\n` +
      `Product: ${product.product_name}\n` +
      `SKU: ${product.sku}\n` +
      `Local Quantity: ${product.quantity}\n\n` +
      `This will update ALL variants of this SKU in Shopify to match local quantity.\n\n` +
      `Are you sure you want to continue?`
    )

    if (!confirm) return

    try {
      setSyncing(true)
      console.log('Sending sync request for product:', product.sku)
      
      const response = await axios.post('/api/inventory/sync-to-shopify', {
        productId: product.id,
        sku: product.sku,
        quantity: product.quantity
      })

      console.log('Sync response:', response.data)

      if (response.data.success) {
        const summary = response.data.summary
        const variantCount = summary.total_variants_updated || 0
        toast.success(`✅ Successfully synced "${product.product_name}" - Updated ${variantCount} variants to ${product.quantity} units each`)
        fetchInventoryComparison() // Refresh data
      } else {
        toast.error(`❌ Sync failed: ${response.data.message || 'Unknown error'}`)
      }
    } catch (error: any) {
      console.error('Sync error:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to sync product'
      toast.error(`❌ Sync failed: ${errorMessage}`)
    } finally {
      setSyncing(false)
    }
  }

  const showAuditReport = async (product: Product) => {
    setAuditLoading(true)
    setShowAuditModal(true)
    
    try {
      const response = await axios.get(`/api/products/audit-report?productId=${product.id}`)
      if (response.data.success) {
        setAuditData(response.data)
      } else {
        toast.error('Failed to load audit report')
      }
    } catch (error) {
      console.error('Error fetching audit report:', error)
      toast.error('Failed to load audit report')
    } finally {
      setAuditLoading(false)
    }
  }

  const syncSelectedToShopify = async () => {
    if (selectedProducts.size === 0) {
      toast.error('No products selected')
      return
    }

    const selectedComparisons = comparisons.filter(c => selectedProducts.has(c.product.id))
    
    if (!window.confirm(`Sync ${selectedProducts.size} selected products to all connected Shopify stores?`)) {
      return
    }

    setSyncing(true)
    try {
      const response = await axios.post('/api/inventory/sync-to-shopify', {
        products: selectedComparisons.map(c => ({
          id: c.product.id,
          sku: c.product.sku,
          quantity: c.product.quantity
        }))
      })

      if (response.data.success) {
        toast.success(`Successfully synced ${selectedProducts.size} products to Shopify`)
        setSelectedProducts(new Set())
        fetchInventoryComparison()
      }
    } catch (error: any) {
      toast.error('Failed to sync selected products')
    } finally {
      setSyncing(false)
    }
  }

  const syncAllToShopify = async () => {
    const confirm = window.confirm(
      `🚀 SYNC ALL PRODUCTS TO SHOPIFY\n\n` +
      `Total products: ${stats?.totalProducts || 0}\n` +
      `Connected stores: ${stores.length}\n\n` +
      `This will sync ALL products from local inventory to Shopify stores.\n` +
      `This operation may take several minutes due to rate limiting.\n\n` +
      `Are you sure you want to continue?`
    )

    if (!confirm) return

    try {
      setSyncing(true)
      setSyncProgress({
        isVisible: true,
        current: 0,
        total: stats?.totalProducts || 0,
        message: 'Starting bulk sync...',
        successCount: 0,
        errorCount: 0
      })

      const response = await axios.post('/api/inventory/sync-all-to-shopify', {})

      if (response.data.success) {
        const summary = response.data.summary
        setSyncProgress({
          isVisible: true,
          current: summary.total_products,
          total: summary.total_products,
          message: 'Sync completed!',
          successCount: summary.successful_products,
          errorCount: summary.failed_products
        })

        if (summary.successful_products === summary.total_products) {
          toast.success(`✅ Successfully synced all ${summary.total_products} products to Shopify!`)
        } else if (summary.successful_products > 0) {
          toast(`⚠️ Partial sync: ${summary.successful_products}/${summary.total_products} products synced successfully`, {
            duration: 8000,
            icon: '⚠️'
          })
        } else {
          toast.error(`❌ Sync failed: No products were synced successfully`)
        }

        setTimeout(() => {
          setSyncProgress(prev => ({ ...prev, isVisible: false }))
        }, 3000)

        fetchInventoryComparison()
      } else {
        throw new Error(response.data.message || 'Sync failed')
      }
    } catch (error: any) {
      console.error('Bulk sync error:', error)
      setSyncProgress(prev => ({
        ...prev,
        message: `Error: ${error.response?.data?.message || error.message}`,
        isVisible: true
      }))
      
      toast.error(`Failed to sync products: ${error.response?.data?.message || error.message}`)
      
      setTimeout(() => {
        setSyncProgress(prev => ({ ...prev, isVisible: false }))
      }, 5000)
    } finally {
      setSyncing(false)
    }
  }

  const handleSelectProduct = (productId: number) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedProducts.size === comparisons.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(comparisons.map(c => c.product.id)))
    }
  }

  const toggleProductExpansion = (productId: number) => {
    const newExpanded = new Set(expandedProducts)
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId)
    } else {
      newExpanded.add(productId)
    }
    setExpandedProducts(newExpanded)
  }

  const generateSyncReport = async () => {
    setLoadingReport(true)
    try {
      const response = await axios.get('/api/inventory/sync-report')
      setSyncReport(response.data)
      setShowReport(true)
      toast.success('Sync report generated successfully!')
    } catch (error: any) {
      console.error('Error generating sync report:', error)
      toast.error('Failed to generate sync report')
    } finally {
      setLoadingReport(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_sync':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'local_higher':
        return <TrendingUp className="h-4 w-4 text-blue-500" />
      case 'shopify_higher':
        return <TrendingDown className="h-4 w-4 text-orange-500" />
      case 'not_found':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'in_sync':
        return 'In Sync'
      case 'local_higher':
        return 'Local Higher'
      case 'shopify_higher':
        return 'Shopify Higher'
      case 'not_found':
        return 'Not Found in Shopify'
      default:
        return 'Unknown'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_sync':
        return 'bg-green-100 text-green-800'
      case 'local_higher':
        return 'bg-blue-100 text-blue-800'
      case 'shopify_higher':
        return 'bg-orange-100 text-orange-800'
      case 'not_found':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Calculate summary stats
  const totalProducts = pagination?.total || 0
  const inSyncCount = comparisons.filter(c => c.status === 'in_sync').length
  const outOfSyncCount = comparisons.filter(c => c.status !== 'in_sync').length
  const localHigherCount = comparisons.filter(c => c.status === 'local_higher').length
  const shopifyHigherCount = comparisons.filter(c => c.status === 'shopify_higher').length

  return (
    <ProtectedRoute requiredPermission="viewProducts">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Shopify vs Local Inventory</h1>
              <p className="text-gray-600">Compare and sync inventory between local database and Shopify stores</p>
              <p className="text-sm text-blue-600 font-medium mt-1">
                📊 Showing {pagination?.total || 0} products with multi-variant support
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchInventoryComparison()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {selectedProducts.size > 0 && (
                <button
                  onClick={syncSelectedToShopify}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : `Sync Selected (${selectedProducts.size})`}
                </button>
              )}
              <button
                onClick={syncAllToShopify}
                disabled={syncing || totalProducts === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : `Sync All Products (${totalProducts})`}
              </button>
              <button
                onClick={generateSyncReport}
                disabled={loadingReport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <FileText className={`h-4 w-4 ${loadingReport ? 'animate-pulse' : ''}`} />
                {loadingReport ? 'Generating...' : 'Sync Report'}
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
                </div>
                <Package className="h-8 w-8 text-gray-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Local Higher</p>
                  <p className="text-2xl font-bold text-blue-600">{localHigherCount}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Shopify Higher</p>
                  <p className="text-2xl font-bold text-orange-600">{shopifyHigherCount}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-orange-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Sync</p>
                  <p className="text-2xl font-bold text-green-600">{inSyncCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </div>
          </div>

          {/* Connected Stores */}
          {stores.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Store className="h-5 w-5" />
                Connected Shopify Stores ({stores.length} connected)
              </h3>
              <div className="flex flex-wrap gap-3">
                {stores.map((store) => (
                  <div key={store.id} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">{store.store_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products by name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="in_sync">In Sync</option>
                  <option value="local_higher">Local Higher</option>
                  <option value="shopify_higher">Shopify Higher</option>
                  <option value="not_found">Not Found</option>
                </select>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="smart">Smart (Shopify products first)</option>
                  <option value="difference">Difference</option>
                  <option value="shopify_quantity">Shopify Quantity</option>
                </select>

                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Products List */}
          <div className="bg-white rounded-lg shadow-sm border">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading inventory comparison...</span>
              </div>
            ) : comparisons.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No products found matching your criteria</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {comparisons.map((comparison) => (
                  <div key={comparison.product.id} className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Selection Checkbox */}
                      <div className="flex-shrink-0 pt-1">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(comparison.product.id)}
                          onChange={() => handleSelectProduct(comparison.product.id)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </div>

                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        {comparison.product.image_url ? (
                          <img
                            className="h-16 w-16 rounded-lg object-cover border border-gray-200"
                            src={comparison.product.image_url}
                            alt={comparison.product.product_name}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                            <Package className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {comparison.product.product_name}
                            </h3>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                                {comparison.product.sku}
                              </span>
                              {comparison.product.category && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {comparison.product.category}
                                </span>
                              )}
                            </div>

                            {/* Inventory Comparison */}
                            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-gray-500">Local Quantity</p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {comparison.local_quantity}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Shopify Total</p>
                                <p className="text-sm font-semibold text-blue-600">
                                  {comparison.total_shopify_quantity}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Variants Found</p>
                                <p className="text-sm font-semibold text-purple-600">
                                  {comparison.total_variants_found}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Difference</p>
                                <p className={`text-sm font-semibold ${
                                  comparison.difference > 0 ? 'text-green-600' :
                                  comparison.difference < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {comparison.difference > 0 ? '+' : ''}{comparison.difference}
                                </p>
                              </div>
                            </div>

                            {/* Store Details */}
                            <div className="mt-3">
                              {Object.entries(comparison.shopify_quantities).map(([storeId, storeData]) => (
                                <div key={storeId} className="text-xs text-gray-600 mb-1">
                                  <span className="font-medium">{storeData.store_name}:</span> {storeData.quantity} units
                                  {storeData.variant_count > 1 && (
                                    <span className="ml-2 text-purple-600">
                                      ({storeData.variant_count} variants)
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Status and Actions */}
                          <div className="flex flex-col items-end gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(comparison.status)}`}>
                              {getStatusIcon(comparison.status)}
                              {getStatusText(comparison.status)}
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => syncProductToShopify(comparison.product)}
                                disabled={syncing || comparison.status === 'in_sync'}
                                className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                                  comparison.status === 'in_sync' 
                                    ? 'text-gray-400 cursor-not-allowed' 
                                    : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                } disabled:opacity-50`}
                                title={comparison.status === 'in_sync' ? 'Already in sync' : 'Sync all variants to Shopify'}
                              >
                                <RefreshCw className="h-3 w-3" />
                                Sync All
                              </button>
                              <button
                                onClick={() => showAuditReport(comparison.product)}
                                className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                                title="View audit report"
                              >
                                <FileText className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Variant Details (Expandable) */}
                        {comparison.total_variants_found > 0 && (
                          <div className="mt-3">
                            <button
                              onClick={() => toggleProductExpansion(comparison.product.id)}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                            >
                              {expandedProducts.has(comparison.product.id) ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              View {comparison.total_variants_found} variant{comparison.total_variants_found > 1 ? 's' : ''}
                            </button>

                            {expandedProducts.has(comparison.product.id) && (
                              <div className="mt-2 bg-gray-50 rounded-lg p-3">
                                <h4 className="text-xs font-semibold text-gray-700 mb-2">Variant Details:</h4>
                                <div className="space-y-2">
                                  {Object.entries(comparison.shopify_quantities).map(([storeId, storeData]) => (
                                    <div key={storeId}>
                                      <p className="text-xs font-medium text-gray-600 mb-1">
                                        {storeData.store_name}:
                                      </p>
                                      <div className="grid grid-cols-1 gap-1">
                                        {storeData.variants.map((variant, index) => (
                                          <div key={index} className="flex justify-between text-xs bg-white px-2 py-1 rounded">
                                            <span>{variant.variantTitle}</span>
                                            <span className="font-mono">{variant.quantity} units</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center text-sm text-gray-700">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} results
                  </div>
                  <div className="flex items-center gap-2 mt-3 sm:mt-0">
                    <button
                      onClick={() => setCurrentPage(pagination.page - 1)}
                      disabled={!pagination.hasPrev}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-700">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(pagination.page + 1)}
                      disabled={!pagination.hasNext}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sync Progress Modal */}
          {syncProgress.isVisible && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Syncing to Shopify</h3>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                    <span className="text-sm text-gray-600">In Progress</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{syncProgress.message}</span>
                    <span>{syncProgress.current}/{syncProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ 
                        width: syncProgress.total > 0 ? `${(syncProgress.current / syncProgress.total) * 100}%` : '0%' 
                      }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-green-600 font-semibold text-lg">{syncProgress.successCount}</div>
                    <div className="text-green-700">Successful</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-red-600 font-semibold text-lg">{syncProgress.errorCount}</div>
                    <div className="text-red-700">Failed</div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-gray-500 text-center">
                  This operation may take several minutes due to Shopify rate limiting
                </div>
              </div>
            </div>
          )}

          {/* Audit Modal */}
          {showAuditModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Product Audit Report</h3>
                  <button
                    onClick={() => setShowAuditModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>

                {auditLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Loading audit report...</span>
                  </div>
                ) : auditData ? (
                  <div className="space-y-6">
                    {/* Product Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Product Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">SKU:</span>
                          <span className="ml-2 font-mono">{auditData.product.sku}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Current Quantity:</span>
                          <span className="ml-2 font-semibold">{auditData.product.quantity}</span>
                        </div>
                      </div>
                    </div>

                    {/* Audit Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {auditData.auditReport?.totalSyncs || 0}
                        </div>
                        <div className="text-sm text-blue-700">Total Syncs</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {auditData.auditReport?.successfulSyncs || 0}
                        </div>
                        <div className="text-sm text-green-700">Successful</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {auditData.auditReport?.failedSyncs || 0}
                        </div>
                        <div className="text-sm text-red-700">Failed</div>
                      </div>
                    </div>

                    {/* Sync History */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Recent Sync History</h4>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">
                        {auditData.auditReport?.syncHistory?.length > 0 ? (
                          <div className="space-y-2">
                            {auditData.auditReport.syncHistory.slice(0, 10).map((sync: any, index: number) => (
                              <div key={index} className="text-sm border-b border-gray-200 pb-2">
                                <div className="flex justify-between items-center">
                                  <span className={`font-medium ${sync.success ? 'text-green-600' : 'text-red-600'}`}>
                                    {sync.success ? '✅' : '❌'} SYNC
                                  </span>
                                  <span className="text-gray-500">{new Date(sync.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="text-gray-600">Quantity: {sync.quantity}</div>
                                <div className="text-gray-500">By: {sync.user_name || 'System'}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-4">No sync history found</p>
                        )}
                      </div>
                    </div>

                    {/* Quantity Changes */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Recent Quantity Changes</h4>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">
                        {auditData.auditReport?.quantityHistory?.length > 0 ? (
                          <div className="space-y-2">
                            {auditData.auditReport.quantityHistory.slice(0, 10).map((change: any, index: number) => (
                              <div key={index} className="text-sm border-b border-gray-200 pb-2">
                                <div className="flex justify-between items-center">
                                  <span className={`font-medium ${change.change_type === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
                                    {change.change_type === 'increase' ? '⬆️' : '⬇️'} {change.type.replace('_', ' ').toUpperCase()}
                                  </span>
                                  <span className="text-gray-500">{new Date(change.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="text-gray-600">Quantity: {change.quantity}</div>
                                <div className="text-gray-500">By: {change.user_name || 'System'}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-4">No quantity changes found</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Failed to load audit report</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sync Report Modal */}
        {showReport && syncReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Sync Report</h2>
                <button
                  onClick={() => setShowReport(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{syncReport.summary.total_syncs}</div>
                    <div className="text-sm text-blue-800">Total Syncs</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{syncReport.summary.successful_syncs}</div>
                    <div className="text-sm text-green-800">Successful</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{syncReport.summary.failed_syncs}</div>
                    <div className="text-sm text-red-800">Failed</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{syncReport.summary.success_rate}%</div>
                    <div className="text-sm text-purple-800">Success Rate</div>
                  </div>
                </div>

                {/* Recent Activities */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Sync Activities</h3>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                    {syncReport.recent_activities.length > 0 ? (
                      <div className="space-y-2">
                        {syncReport.recent_activities.slice(0, 10).map((activity: any, index: number) => (
                          <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                              <span className={activity.success ? 'text-green-600' : 'text-red-600'}>
                                {activity.success ? '✅' : '❌'}
                              </span>
                              <span className="font-medium">{activity.sku}</span>
                              <span className="text-gray-600">{activity.product_name}</span>
                              {activity.variants_updated > 0 && (
                                <span className="text-blue-600 text-sm">({activity.variants_updated} variants)</span>
                              )}
                            </div>
                            <span className="text-gray-500 text-sm">
                              {new Date(activity.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No recent activities</p>
                    )}
                  </div>
                </div>

                {/* Store Performance */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Store Performance</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left p-2">Store</th>
                          <th className="text-right p-2">Total Syncs</th>
                          <th className="text-right p-2">Successful</th>
                          <th className="text-right p-2">Failed</th>
                          <th className="text-right p-2">Success Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncReport.store_performance.map((store: any, index: number) => (
                          <tr key={index} className="border-b border-gray-200">
                            <td className="p-2 font-medium">{store.store_name}</td>
                            <td className="p-2 text-right">{store.total_syncs}</td>
                            <td className="p-2 text-right text-green-600">{store.successful_syncs}</td>
                            <td className="p-2 text-right text-red-600">{store.failed_syncs}</td>
                            <td className="p-2 text-right">{store.success_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Synced Products */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Top Synced Products</h3>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                    {syncReport.top_synced_products.length > 0 ? (
                      <div className="space-y-2">
                        {syncReport.top_synced_products.map((product: any, index: number) => (
                          <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200">
                            <div>
                              <div className="font-medium">{product.sku}</div>
                              <div className="text-sm text-gray-600">{product.product_name}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">{product.sync_count} syncs</div>
                              <div className="text-sm text-gray-500">
                                Last: {new Date(product.last_sync).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No data available</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  )
}