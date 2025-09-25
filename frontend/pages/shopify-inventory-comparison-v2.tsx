import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { 
  Search, 
  Filter, 
  RefreshCw, 
  RotateCcw, 
  FileText, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Store,
  Package,
  Eye,
  Download
} from 'lucide-react'

interface Product {
  id: number
  sku: string
  product_name: string
  category: string
  price: number
  quantity: number
  description: string
  image_url: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ShopifyQuantity {
  quantity: number
  store_name: string
  variants: Array<{
    variantId: number
    variantTitle: string
    inventoryItemId: number
    quantity: number
    locations: Array<{
      locationId: number
      quantity: number
    }>
  }>
  variant_count: number
  found: boolean
  error?: string
}

interface Comparison {
  product: Product
  local_quantity: number
  shopify_quantities: Record<number, ShopifyQuantity>
  total_shopify_quantity: number
  total_variants_found: number
  difference: number
  status: 'in_sync' | 'not_found' | 'local_higher' | 'shopify_higher'
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface Stats {
  totalProducts: number
  modifiedProducts: number
}

interface Store {
  id: number
  store_name: string
  store_domain: string
}

interface InventoryComparisonResponse {
  success: boolean
  comparisons: Comparison[]
  pagination: Pagination
  stats: Stats
  stores: Store[]
  message?: string
}

export default function ShopifyInventoryComparisonV2() {
  const router = useRouter()
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setRotateCcwing] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState('smart')
  const [sortOrder, setSortOrder] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())

  const fetchInventoryComparison = async (page = 1) => {
    try {
      setLoading(true)
      console.log('🔄 Fetching inventory comparison...')
      
      const response = await axios.get<InventoryComparisonResponse>('/api/inventory/comparison-v2', {
        params: {
          page,
          limit: 25,
          search: searchTerm,
          status: statusFilter,
          category: categoryFilter,
          sortBy,
          sortOrder
        }
      })

      console.log('📊 Inventory comparison response:', response.data)

      if (response.data.success) {
        setComparisons(response.data.comparisons)
        setPagination(response.data.pagination)
        setStats(response.data.stats)
        setStores(response.data.stores)
        setCurrentPage(page)
      } else {
        toast.error('Failed to fetch inventory comparison')
      }
    } catch (error: any) {
      console.error('❌ Error fetching inventory comparison:', error)
      toast.error(`Failed to fetch inventory comparison: ${error.response?.data?.message || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInventoryComparison(1)
  }, [searchTerm, statusFilter, categoryFilter, sortBy, sortOrder])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchInventoryComparison(1)
  }

  const syncProductToShopify = async (product: Product) => {
    console.log('🔄 RotateCcwing product:', product)
    
    const confirm = window.confirm(
      `🔄 SYNC TO SHOPIFY\n\n` +
      `Product: ${product.product_name}\n` +
      `SKU: ${product.sku}\n` +
      `Local Quantity: ${product.quantity}\n\n` +
      `This will update the Shopify inventory to match local quantity.\n\n` +
      `Are you sure you want to continue?`
    )

    if (!confirm) return

    try {
      setRotateCcwing(true)
      console.log('📤 Sending sync request for product:', product.sku)
      
      const response = await axios.post('/api/inventory/sync-to-shopify', {
        productId: product.id,
        sku: product.sku,
        quantity: product.quantity
      })

      console.log('✅ RotateCcw response:', response.data)

      if (response.data.success) {
        const summary = response.data.summary
        const variantCount = summary.total_variants_updated || 0
        toast.success(`✅ Successfully synced "${product.product_name}" - Updated ${variantCount} variants to ${product.quantity} units each`)
        fetchInventoryComparison(currentPage) // Refresh data
      } else {
        toast.error(`❌ RotateCcw failed: ${response.data.message || 'Unknown error'}`)
      }
    } catch (error: any) {
      console.error('❌ RotateCcw error:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to sync product'
      toast.error(`❌ RotateCcw failed: ${errorMessage}`)
    } finally {
      setRotateCcwing(false)
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_sync':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'not_found':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'local_higher':
        return <ArrowUp className="h-4 w-4 text-blue-500" />
      case 'shopify_higher':
        return <ArrowDown className="h-4 w-4 text-orange-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'in_sync':
        return 'In RotateCcw'
      case 'not_found':
        return 'Not Found in Shopify'
      case 'local_higher':
        return 'Local Higher'
      case 'shopify_higher':
        return 'Shopify Higher'
      default:
        return 'Unknown'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_sync':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'not_found':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'local_higher':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'shopify_higher':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Shopify vs Local Inventory V2
          </h1>
          <p className="text-gray-600">
            Compare and sync inventory between local database and Shopify stores
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Showing {stats?.totalProducts || 0} products with enhanced multi-variant support
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => fetchInventoryComparison(currentPage)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={() => fetchInventoryComparison(currentPage)}
            disabled={loading || syncing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <RotateCcw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            RotateCcw All Products ({stats?.totalProducts || 0})
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-3">
                <ArrowUp className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Local Higher</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {comparisons.filter(c => c.status === 'local_higher').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-3">
                <ArrowDown className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Shopify Higher</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {comparisons.filter(c => c.status === 'shopify_higher').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">In RotateCcw</p>
                  <p className="text-2xl font-bold text-green-600">
                    {comparisons.filter(c => c.status === 'in_sync').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Connected Stores */}
        {stores.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Store className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">
                Connected Shopify Stores ({stores.length} connected)
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {stores.map(store => (
                <div key={store.id} className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">{store.store_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
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
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="not_found">Not Found in Shopify</option>
              <option value="local_higher">Local Higher</option>
              <option value="shopify_higher">Shopify Higher</option>
              <option value="in_sync">In RotateCcw</option>
            </select>
            
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="sunglasses">Sunglasses</option>
            </select>
            
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-')
                setSortBy(newSortBy)
                setSortOrder(newSortOrder)
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="smart-desc">Smart (Shopify products first)</option>
              <option value="difference-desc">Highest Difference</option>
              <option value="difference-asc">Lowest Difference</option>
              <option value="product_name-asc">Product Name A-Z</option>
              <option value="product_name-desc">Product Name Z-A</option>
            </select>
          </form>
        </div>

        {/* Products List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading inventory comparison...</span>
          </div>
        ) : comparisons.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comparisons.map((comparison) => (
              <div key={comparison.product.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                {/* Product Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <img
                        src={comparison.product.image_url || '/placeholder-product.png'}
                        alt={comparison.product.product_name}
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {comparison.product.product_name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        SKU: <span className="font-mono font-medium">{comparison.product.sku}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {comparison.product.category}
                        </span>
                        <button
                          onClick={() => toggleProductExpansion(comparison.product.id)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          <Eye className="h-3 w-3" />
                          {expandedProducts.has(comparison.product.id) ? 'Hide' : 'Show'} Details
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(comparison.status)}`}>
                          {getStatusIcon(comparison.status)}
                          {getStatusText(comparison.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Product Details */}
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Local Quantity</p>
                      <p className="text-xl font-bold text-gray-900">{comparison.local_quantity}</p>
                    </div>
                    
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Shopify Total</p>
                      <p className="text-xl font-bold text-blue-600">{comparison.total_shopify_quantity}</p>
                    </div>
                    
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-gray-600">Variants Found</p>
                      <p className="text-xl font-bold text-purple-600">{comparison.total_variants_found}</p>
                    </div>
                    
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm text-gray-600">Difference</p>
                      <p className={`text-xl font-bold ${comparison.difference > 0 ? 'text-green-600' : comparison.difference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {comparison.difference > 0 ? '+' : ''}{comparison.difference}
                      </p>
                    </div>
                  </div>

                  {/* Store Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(comparison.shopify_quantities).map(([storeId, storeData]) => (
                      <div key={storeId} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{storeData.store_name}</h4>
                          <span className="text-sm text-gray-600">{storeData.quantity} units</span>
                        </div>
                        
                        {storeData.error && (
                          <p className="text-xs text-red-600 mb-2">{storeData.error}</p>
                        )}
                        
                        {expandedProducts.has(comparison.product.id) && storeData.variants.length > 0 && (
                          <div className="space-y-2">
                            {storeData.variants.map((variant, index) => (
                              <div key={index} className="text-xs bg-white p-2 rounded border">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{variant.variantTitle}</span>
                                  <span className="text-blue-600">{variant.quantity} units</span>
                                </div>
                                {variant.locations.length > 0 && (
                                  <div className="mt-1 text-gray-500">
                                    {variant.locations.map((location, locIndex) => (
                                      <div key={locIndex} className="flex justify-between">
                                        <span>Location {location.locationId}:</span>
                                        <span>{location.quantity}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      {comparison.status !== 'in_sync' && (
                        <button
                          onClick={() => syncProductToShopify(comparison.product)}
                          disabled={syncing}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                        >
                          <RotateCcw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                          RotateCcw All
                        </button>
                      )}
                      
                      <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                        <FileText className="h-4 w-4" />
                        Audit Report
                      </button>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      Last updated: {new Date(comparison.product.updated_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchInventoryComparison(pagination.page - 1)}
                disabled={!pagination.hasPrev || loading}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <span className="px-3 py-2 text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              
              <button
                onClick={() => fetchInventoryComparison(pagination.page + 1)}
                disabled={!pagination.hasNext || loading}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
