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
  FileText
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
}

interface InventoryComparison {
  product: Product
  local_quantity: number
  shopify_quantities: { [storeId: string]: { quantity: number, store_name: string } }
  total_shopify_quantity: number
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
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(25)
  const [pagination, setPagination] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set())
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [auditData, setAuditData] = useState<any>(null)
  const [auditLoading, setAuditLoading] = useState(false)

  const { user, isFullyAuthenticated } = useAuth()

  useEffect(() => {
    if (isFullyAuthenticated) {
      fetchInventoryComparison()
      fetchStores()
    }
  }, [isFullyAuthenticated])

  // Trigger search when searchTerm changes
  useEffect(() => {
    if (isFullyAuthenticated) {
      setCurrentPage(1) // Reset to first page when searching
      fetchInventoryComparison(1)
    }
  }, [searchTerm])

  // Trigger refresh when filter status changes
  useEffect(() => {
    if (isFullyAuthenticated) {
      setCurrentPage(1) // Reset to first page when filtering
      fetchInventoryComparison(1)
    }
  }, [filterStatus])

  // Selection handlers
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

  const fetchStores = async () => {
    try {
      const response = await axios.get('/api/stores')
      setStores(response.data.filter((store: Store) => store.connected))
    } catch (error) {
      console.error('Failed to fetch stores:', error)
    }
  }

  const fetchInventoryComparison = async (page = 1) => {
    try {
      setLoading(true)
      const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''
      const response = await axios.get(`/api/inventory/comparison?page=${page}&limit=${itemsPerPage}${searchParam}`)
          if (response.data.success) {
            setComparisons(response.data.comparisons)
            setPagination(response.data.pagination)
            setStats(response.data.stats)
          }
    } catch (error: any) {
      console.error('Error fetching inventory comparison:', error)
      toast.error('Failed to fetch inventory comparison')
    } finally {
      setLoading(false)
    }
  }

  const syncProductToShopify = async (product: Product) => {
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
      setSyncing(true)
      const response = await axios.post('/api/inventory/sync-to-shopify', {
        productId: product.id,
        sku: product.sku,
        quantity: product.quantity
      })

      if (response.data.success) {
        toast.success(`Successfully synced "${product.product_name}" to Shopify`)
        fetchInventoryComparison(currentPage) // Refresh data
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to sync product')
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
      }
    } catch (error: any) {
      toast.error('Failed to fetch audit report: ' + (error.response?.data?.message || error.message))
      setShowAuditModal(false)
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
        toast.success(`Successfully synced ${selectedProducts.size} selected products to Shopify`)
        setSelectedProducts(new Set()) // Clear selection
        fetchInventoryComparison() // Refresh data
      }
    } catch (error: any) {
      toast.error('Failed to sync products: ' + (error.response?.data?.message || error.message))
    } finally {
      setSyncing(false)
    }
  }

  const syncAllToShopify = async () => {
    const outOfSyncProducts = comparisons.filter(c => c.status !== 'in_sync')
    
    if (outOfSyncProducts.length === 0) {
      toast.success('🎉 All products are already in sync!')
      return
    }

    const confirm = window.confirm(
      `🚀 SYNC ALL TO SHOPIFY\n\n` +
      `Products to sync: ${outOfSyncProducts.length}\n` +
      `Connected stores: ${stores.length}\n\n` +
      `This will update all Shopify inventories to match local quantities.\n\n` +
      `Are you sure you want to continue?`
    )

    if (!confirm) return

    try {
      setSyncing(true)
      let successCount = 0
      let errorCount = 0

      for (const comparison of outOfSyncProducts) {
        try {
          const response = await axios.post('/api/inventory/sync-to-shopify', {
            productId: comparison.product.id,
            sku: comparison.product.sku,
            quantity: comparison.local_quantity
          })

          if (response.data.success) {
            successCount++
          } else {
            errorCount++
          }
        } catch (error) {
          errorCount++
        }
      }

      if (successCount > 0 && errorCount === 0) {
        toast.success(`✅ Successfully synced ${successCount} products to Shopify`)
      } else if (successCount > 0 && errorCount > 0) {
        toast(`⚠️ Partial sync: ${successCount} successful, ${errorCount} failed`, {
          duration: 6000,
          icon: '⚠️'
        })
      } else {
        toast.error(`❌ Sync failed: ${errorCount} errors occurred`)
      }

      fetchInventoryComparison(currentPage) // Refresh data
    } catch (error: any) {
      toast.error('Failed to sync products to Shopify')
    } finally {
      setSyncing(false)
    }
  }

  // Filter comparisons by status only (search is now server-side)
  const filteredComparisons = comparisons.filter(comparison => {
    const matchesFilter = filterStatus === 'all' || comparison.status === filterStatus
    return matchesFilter
  })

  // Use server-side pagination
  const paginatedComparisons = filteredComparisons
  const totalPages = pagination?.totalPages || 1

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

  // Calculate summary stats from pagination data
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
                📊 Showing all {stats?.totalProducts || 0} products ({stats?.modifiedProducts || 0} need sync)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchInventoryComparison(1)}
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
                disabled={syncing || outOfSyncCount === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : `Sync All (${outOfSyncCount})`}
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalProducts || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats?.modifiedProducts || 0} need sync</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Sync</p>
                  <p className="text-2xl font-bold text-green-600">{inSyncCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Local Higher</p>
                  <p className="text-2xl font-bold text-blue-600">{localHigherCount}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Shopify Higher</p>
                  <p className="text-2xl font-bold text-orange-600">{shopifyHigherCount}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Filters and Search */}
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
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="in_sync">In Sync</option>
                  <option value="local_higher">Local Higher</option>
                  <option value="shopify_higher">Shopify Higher</option>
                  <option value="not_found">Not Found</option>
                </select>
              </div>
            </div>
          </div>

          {/* Connected Stores Info */}
          {stores.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Store className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium text-blue-900">Connected Shopify Stores</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {stores.map((store) => (
                  <span
                    key={store.id}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {store.store_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Results Summary */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {paginatedComparisons.length} of {totalProducts} products
                {pagination && ` (Page ${pagination.page} of ${pagination.totalPages})`}
              </p>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedProducts.size === comparisons.length && comparisons.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Local Qty
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shopify Qty
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Difference
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
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex items-center justify-center">
                          <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                          <span className="text-gray-500">Loading inventory comparison...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedComparisons.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="text-gray-500">
                          {searchTerm || filterStatus !== 'all' 
                            ? 'No products match your filters' 
                            : (
                              <div className="flex flex-col items-center gap-2">
                                <CheckCircle className="h-12 w-12 text-green-500" />
                                <div className="text-lg font-medium text-green-600">All products are up to date!</div>
                                <div className="text-sm text-gray-500">No modified products need syncing</div>
                              </div>
                            )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedComparisons.map((comparison) => (
                      <tr key={comparison.product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(comparison.product.id)}
                            onChange={() => handleSelectProduct(comparison.product.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {comparison.product.image_url && (
                              <img
                                className="h-10 w-10 rounded-lg object-cover mr-3"
                                src={comparison.product.image_url}
                                alt={comparison.product.product_name}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {comparison.product.product_name}
                              </div>
                              {comparison.product.category && (
                                <div className="text-sm text-gray-500">{comparison.product.category}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {comparison.product.sku}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {comparison.local_quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            {Object.entries(comparison.shopify_quantities).map(([storeId, data]) => (
                              <div key={storeId} className="text-sm">
                                <span className="font-medium">{data.quantity}</span>
                                <span className="text-gray-500 ml-1">({data.store_name})</span>
                              </div>
                            ))}
                            {Object.keys(comparison.shopify_quantities).length === 0 && (
                              <span className="text-sm text-gray-500">Not found</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${
                            comparison.difference > 0 ? 'text-blue-600' : 
                            comparison.difference < 0 ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            {comparison.difference > 0 ? '+' : ''}{comparison.difference}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(comparison.status)}`}>
                            {getStatusIcon(comparison.status)}
                            <span className="ml-1">{getStatusText(comparison.status)}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            {comparison.status !== 'in_sync' && comparison.status !== 'not_found' && (
                              <button
                                onClick={() => syncProductToShopify(comparison.product)}
                                disabled={syncing}
                                className="text-green-600 hover:text-green-900 flex items-center gap-1 disabled:opacity-50"
                                title="Sync to Shopify"
                              >
                                <RefreshCw className="h-4 w-4" />
                                Sync
                              </button>
                            )}
                            <button
                              onClick={() => showAuditReport(comparison.product)}
                              className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                              title="View Audit Report"
                            >
                              <FileText className="h-4 w-4" />
                              Audit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination && totalPages > 1 && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Page {pagination.page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newPage = Math.max(1, currentPage - 1)
                      setCurrentPage(newPage)
                      fetchInventoryComparison(newPage)
                    }}
                    disabled={!pagination.hasPrev}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => {
                      const newPage = Math.min(totalPages, currentPage + 1)
                      setCurrentPage(newPage)
                      fetchInventoryComparison(newPage)
                    }}
                    disabled={!pagination.hasNext}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Audit Modal */}
          {showAuditModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Detailed Audit Report
                    </h3>
                    <button
                      onClick={() => setShowAuditModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XCircle className="h-6 w-6" />
                    </button>
                  </div>

                  {auditLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-500">Loading audit report...</p>
                    </div>
                  ) : auditData ? (
                    <div className="space-y-6">
                      {/* Product Info */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Product Information</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div><span className="font-medium">Name:</span> {auditData.product.product_name}</div>
                          <div><span className="font-medium">SKU:</span> {auditData.product.sku}</div>
                          <div><span className="font-medium">Current Quantity:</span> {auditData.product.quantity}</div>
                          <div><span className="font-medium">Category:</span> {auditData.product.category || 'N/A'}</div>
                        </div>
                      </div>

                      {/* Statistics */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4">
                          <div className="text-2xl font-bold text-blue-600">{auditData.auditReport.statistics.sync.totalSyncs}</div>
                          <div className="text-sm text-gray-600">Total Syncs</div>
                          <div className="text-xs text-gray-500 mt-1">
                            ✅ {auditData.auditReport.statistics.sync.successfulSyncs} success, 
                            ❌ {auditData.auditReport.statistics.sync.failedSyncs} failed
                          </div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4">
                          <div className="text-2xl font-bold text-green-600">{auditData.auditReport.statistics.quantity.totalChanges}</div>
                          <div className="text-sm text-gray-600">Quantity Changes</div>
                          <div className="text-xs text-gray-500 mt-1">
                            ⬆️ {auditData.auditReport.statistics.quantity.stockInCount} in, 
                            ⬇️ {auditData.auditReport.statistics.quantity.stockOutCount} out
                          </div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4">
                          <div className="text-2xl font-bold text-purple-600">{auditData.auditReport.statistics.scan.totalScans}</div>
                          <div className="text-sm text-gray-600">Total Scans</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Last: {auditData.auditReport.statistics.scan.lastScanDate ? new Date(auditData.auditReport.statistics.scan.lastScanDate).toLocaleDateString() : 'Never'}
                          </div>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-4">
                          <div className="text-2xl font-bold text-orange-600">{auditData.auditReport.statistics.mobile.totalActivities}</div>
                          <div className="text-sm text-gray-600">Mobile Activities</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Last: {auditData.auditReport.statistics.mobile.lastActivityDate ? new Date(auditData.auditReport.statistics.mobile.lastActivityDate).toLocaleDateString() : 'Never'}
                          </div>
                        </div>
                      </div>

                      {/* Recent Activity */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Sync History */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3">Recent Sync History</h4>
                          <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">
                            {auditData.auditReport.syncHistory.length > 0 ? (
                              <div className="space-y-2">
                                {auditData.auditReport.syncHistory.slice(0, 10).map((sync: any, index: number) => (
                                  <div key={index} className="text-sm border-b border-gray-200 pb-2">
                                    <div className="flex justify-between items-center">
                                      <span className={`font-medium ${sync.sync_status === 'success' ? 'text-green-600' : sync.sync_status === 'failed' ? 'text-red-600' : 'text-gray-600'}`}>
                                        {sync.sync_status === 'success' ? '✅' : sync.sync_status === 'failed' ? '❌' : '⚪'} Sync
                                      </span>
                                      <span className="text-gray-500">{new Date(sync.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-gray-600">{sync.notes}</div>
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
                            {auditData.auditReport.quantityHistory.length > 0 ? (
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
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Failed to load audit report</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
