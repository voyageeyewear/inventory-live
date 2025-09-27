import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import {
  Search,
  RefreshCw,
  Sync,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  Loader2
} from 'lucide-react'

interface Product {
  id: number
  sku: string
  name: string
  category: string
  quantity: number
  price: number
}

interface Comparison {
  product: Product
  local_quantity: number
  shopify_quantity: number
  difference: number
  status: 'in_sync' | 'local_higher' | 'shopify_higher' | 'not_found'
  variants?: Array<{
    title: string
    quantity: number
  }>
}

interface SyncProgress {
  current: number
  total: number
  currentSku?: string
}

export default function ShopifyInventoryComparisonV2() {
  const { user, token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set())
  const [bulkSyncing, setBulkSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ current: 0, total: 0 })
  const [syncingProducts, setSyncingProducts] = useState<Set<number>>(new Set())

  const pageSize = 25

  // Load data from API
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: searchTerm.trim(),
        status: statusFilter === 'all' ? '' : statusFilter
      })

      console.log('🔍 Loading inventory comparison data...')
      const response = await axios.get(`/api/inventory/comparison?${params}&_t=${Date.now()}`)
      
      if (response.data.success) {
        setComparisons(response.data.data || [])
        setTotalPages(response.data.totalPages || 1)
        console.log(`✅ Loaded ${response.data.data?.length || 0} comparisons`)
      } else {
        throw new Error(response.data.message || 'Failed to load data')
      }
    } catch (error: any) {
      console.error('❌ Error loading data:', error)
      setError(error.response?.data?.message || error.message || 'Failed to load inventory data')
      setComparisons([])
    } finally {
      setLoading(false)
    }
  }

  // Sync individual product
  const syncProduct = async (product: Product) => {
    try {
      setSyncingProducts(prev => new Set([...prev, product.id]))
      
      const response = await axios.post('/api/inventory/sync-to-shopify', {
        productId: product.id,
        sku: product.sku
      })

      if (response.data.success) {
        toast.success(`✅ Synced ${product.sku} successfully`)
        loadData() // Reload data to get updated quantities
      } else {
        throw new Error(response.data.message || 'Sync failed')
      }
    } catch (error: any) {
      console.error(`❌ Sync error for ${product.sku}:`, error)
      toast.error(`Failed to sync ${product.sku}: ${error.response?.data?.message || error.message}`)
    } finally {
      setSyncingProducts(prev => {
        const newSet = new Set(prev)
        newSet.delete(product.id)
        return newSet
      })
    }
  }

  // Sync all products on current page
  const syncAllProducts = async () => {
    if (comparisons.length === 0) return

    try {
      setBulkSyncing(true)
      setSyncProgress({ current: 0, total: comparisons.length })
      
      let successCount = 0
      let errorCount = 0

      for (let i = 0; i < comparisons.length; i++) {
        const comparison = comparisons[i]
        setSyncProgress({ 
          current: i + 1, 
          total: comparisons.length,
          currentSku: comparison.product.sku 
        })

        try {
          await syncProduct(comparison.product)
          successCount++
        } catch (error) {
          console.error(`❌ Bulk sync error for ${comparison.product.sku}:`, error)
          errorCount++
        }

        // Rate limiting - wait 4.5 seconds between API calls
        if (i < comparisons.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 4500))
        }
      }

      console.log(`✅ Bulk sync completed: ${successCount} success, ${errorCount} errors`)
      toast.success(`Sync completed: ${successCount} successful, ${errorCount} failed`)
      
    } catch (error) {
      console.error('💥 Bulk sync error:', error)
      toast.error('Bulk sync failed')
    } finally {
      setBulkSyncing(false)
      setSyncProgress({ current: 0, total: 0 })
    }
  }

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1)
    loadData()
  }

  // Handle filter change
  const handleFilterChange = () => {
    setCurrentPage(1)
    loadData()
  }

  // Handle product selection
  const handleProductSelect = (productId: number) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }

  // Handle select all
  const handleSelectAll = () => {
    if (selectedProducts.size === comparisons.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(comparisons.map(c => c.product.id)))
    }
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_sync':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">In Sync</span>
      case 'local_higher':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Local Higher</span>
      case 'shopify_higher':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Shopify Higher</span>
      case 'not_found':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Not Found</span>
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Unknown</span>
    }
  }

  // Load data on component mount and when filters change
  useEffect(() => {
    if (user && token) {
      loadData()
    }
  }, [user, token, currentPage, statusFilter])

  // Handle search on Enter key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.target === document.querySelector('input[placeholder*="Search"]')) {
        handleSearch()
      }
    }
    document.addEventListener('keypress', handleKeyPress)
    return () => document.removeEventListener('keypress', handleKeyPress)
  }, [])

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Please log in</h3>
            <p className="mt-1 text-sm text-gray-500">You need to be logged in to view inventory comparisons.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Shopify vs Local Inventory V2</h1>
          <p className="mt-2 text-gray-600">Compare and sync inventory between your local database and Shopify stores.</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Products</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by SKU or product name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="in_sync">In Sync</option>
                <option value="local_higher">Local Higher</option>
                <option value="shopify_higher">Shopify Higher</option>
                <option value="not_found">Not Found</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleSearch}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
            </div>

            <div className="flex items-end">
              <button
                onClick={loadData}
                disabled={loading}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 flex items-center justify-center disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Sync Actions */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Sync Actions</h3>
              <p className="text-sm text-gray-500">
                Sync all {comparisons.length} products on this page one by one with rate limiting
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={syncAllProducts}
                disabled={bulkSyncing || comparisons.length === 0}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center disabled:opacity-50"
              >
                {bulkSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sync className="h-4 w-4 mr-2" />
                )}
                Sync All Products ({comparisons.length})
              </button>
            </div>
          </div>

          {/* Sync Progress */}
          {bulkSyncing && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Syncing {syncProgress.currentSku || 'products'}...</span>
                <span>{syncProgress.current} of {syncProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <XCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading inventory data...</span>
            </div>
          ) : comparisons.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your search criteria or filters.</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Products ({comparisons.length})
                  </h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedProducts.size === comparisons.length && comparisons.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="text-sm text-gray-700">Select All</label>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Select
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
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
                    {comparisons.map((comparison) => (
                      <tr key={comparison.product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(comparison.product.id)}
                            onChange={() => handleProductSelect(comparison.product.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {comparison.product.sku}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {comparison.product.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {comparison.product.category || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {comparison.local_quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {comparison.shopify_quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`font-medium ${
                            comparison.difference > 0 ? 'text-green-600' : 
                            comparison.difference < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {comparison.difference > 0 ? '+' : ''}{comparison.difference}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(comparison.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => syncProduct(comparison.product)}
                            disabled={syncingProducts.has(comparison.product.id)}
                            className="text-blue-600 hover:text-blue-900 disabled:opacity-50 flex items-center"
                          >
                            {syncingProducts.has(comparison.product.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <Sync className="h-4 w-4 mr-1" />
                            )}
                            Sync
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing page <span className="font-medium">{currentPage}</span> of{' '}
                        <span className="font-medium">{totalPages}</span>
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
  )
}