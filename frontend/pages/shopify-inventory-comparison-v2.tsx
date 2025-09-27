import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'

interface Product {
  id: number
  sku: string
  product_name: string
  category: string
  price: string
  quantity: number
  description: string
  image_url: string
  is_active: boolean
  created_at: string
  updated_at: string
  needs_sync: boolean
  last_modified: string
  last_synced: string
  sync_status: string
}

interface ShopifyStore {
  id: number
  store_name: string
  store_domain: string
}

interface ShopifyQuantity {
  quantity: number
  store_name: string
  variants: Array<{
    variantId: string
    variantTitle: string
    inventoryItemId: string
    quantity: number
    locations: Array<{
      locationId: string
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
  shopify_quantities: Record<string, ShopifyQuantity>
  total_shopify_quantity: number
  total_variants_found: number
  difference: number
  status: 'in_sync' | 'local_higher' | 'shopify_higher' | 'not_found'
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

export default function ShopifyInventoryComparisonV2() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  // State management
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [stores, setStores] = useState<ShopifyStore[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters and search
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [storeFilter, setStoreFilter] = useState('all')
  const [sortBy, setSortBy] = useState('smart')
  const [sortOrder, setSortOrder] = useState('desc')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  
  // Sync states
  const [syncingProducts, setSyncingProducts] = useState<Set<number>>(new Set())
  const [syncResults, setSyncResults] = useState<Record<number, any>>({})
  const [bulkSyncing, setBulkSyncing] = useState(false)
  const [bulkSyncProgress, setBulkSyncProgress] = useState({ current: 0, total: 0 })
  const [syncAllProducts, setSyncAllProducts] = useState(false)
  const [syncAllProgress, setSyncAllProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })
  
  // Selection
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // Load data
  const loadData = async () => {
    try {
      setLoadingData(true)
      setError(null)
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: search.trim(),
        status: statusFilter,
        store: storeFilter,
        category: categoryFilter,
        sortBy: sortBy,
        sortOrder: sortOrder
      })
      
      console.log('🔍 Loading inventory comparison data...')
      const response = await axios.get(`/api/inventory/comparison?${params}&_t=${Date.now()}`)
      
      const data = response.data
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to load data')
      }
      
      setComparisons(data.comparisons || [])
      setStores(data.stores || [])
      setPagination(data.pagination || null)
      setStats(data.stats || null)
      
      console.log(`✅ Loaded ${data.comparisons?.length || 0} comparisons`)
      
    } catch (err) {
      console.error('❌ Error loading data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoadingData(false)
    }
  }

  // Load data on mount and when filters change
  useEffect(() => {
    if (user && !loading) {
      loadData()
    }
  }, [user, loading, currentPage, pageSize, search, statusFilter, categoryFilter, storeFilter, sortBy, sortOrder])

  // Sync individual product
  const syncProduct = async (product: Product) => {
    try {
      setSyncingProducts(prev => new Set(prev).add(product.id))
      setSyncResults(prev => ({ ...prev, [product.id]: null }))
      
      console.log(`🔄 Syncing product ${product.sku}...`)
      
      const response = await fetch('/api/inventory/sync-to-shopify-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: product.id,
          sku: product.sku,
          quantity: product.quantity
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        console.log(`✅ Sync successful for ${product.sku}:`, result)
        setSyncResults(prev => ({ ...prev, [product.id]: { success: true, result } }))
        
        // Reload data to show updated status
        setTimeout(() => {
          loadData()
        }, 1000)
      } else {
        console.error(`❌ Sync failed for ${product.sku}:`, result)
        setSyncResults(prev => ({ ...prev, [product.id]: { success: false, result } }))
      }
      
    } catch (error) {
      console.error(`💥 Error syncing ${product.sku}:`, error)
      setSyncResults(prev => ({ ...prev, [product.id]: { success: false, error: error instanceof Error ? error.message : 'Unknown error' } }))
    } finally {
      setSyncingProducts(prev => {
        const newSet = new Set(prev)
        newSet.delete(product.id)
        return newSet
      })
    }
  }

  // Bulk sync selected products
  const bulkSyncSelected = async () => {
    if (selectedProducts.size === 0) return
    
    try {
      setBulkSyncing(true)
      setBulkSyncProgress({ current: 0, total: selectedProducts.size })
      
      const productsToSync = comparisons.filter(comp => selectedProducts.has(comp.product.id))
      let successCount = 0
      let errorCount = 0
      
      for (let i = 0; i < productsToSync.length; i++) {
        const comparison = productsToSync[i]
        setBulkSyncProgress({ current: i + 1, total: productsToSync.length })
        
        try {
          await syncProduct(comparison.product)
          successCount++
        } catch (error) {
          console.error(`❌ Bulk sync error for ${comparison.product.sku}:`, error instanceof Error ? error.message : 'Unknown error')
          errorCount++
        }
        
        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      console.log(`✅ Bulk sync completed: ${successCount} success, ${errorCount} errors`)
      setSelectedProducts(new Set())
      setSelectAll(false)
      
    } catch (error) {
      console.error('💥 Bulk sync error:', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setBulkSyncing(false)
      setBulkSyncProgress({ current: 0, total: 0 })
      loadData()
    }
  }

  // Sync all products on current page
  const syncAllProductsOnPage = async () => {
    if (comparisons.length === 0) return
    
    try {
      setSyncAllProducts(true)
      setSyncAllProgress({ current: 0, total: comparisons.length, success: 0, failed: 0 })
      
      let successCount = 0
      let errorCount = 0
      
      for (let i = 0; i < comparisons.length; i++) {
        const comparison = comparisons[i]
        setSyncAllProgress({ current: i + 1, total: comparisons.length, success: successCount, failed: errorCount })
        
        try {
          await syncProduct(comparison.product)
          successCount++
        } catch (error) {
          console.error(`❌ Sync all error for ${comparison.product.sku}:`, error instanceof Error ? error.message : 'Unknown error')
          errorCount++
        }
        
        // Rate limiting: 4-5 seconds between API calls as requested
        await new Promise(resolve => setTimeout(resolve, 4500))
      }
      
      console.log(`✅ Sync all completed: ${successCount} success, ${errorCount} errors`)
      
    } catch (error) {
      console.error('💥 Sync all error:', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setSyncAllProducts(false)
      setSyncAllProgress({ current: 0, total: 0, success: 0, failed: 0 })
      loadData()
    }
  }

  // Handle selection
  const handleSelectProduct = (productId: number) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
    setSelectAll(newSelected.size === comparisons.length)
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(comparisons.map(comp => comp.product.id)))
    }
    setSelectAll(!selectAll)
  }

  // Get status color and text
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'in_sync':
        return { color: 'green', text: 'In Sync', icon: '✓' }
      case 'local_higher':
        return { color: 'blue', text: 'Local Higher', icon: '↑' }
      case 'shopify_higher':
        return { color: 'orange', text: 'Shopify Higher', icon: '↓' }
      case 'not_found':
        return { color: 'red', text: 'Not Found in Shopify', icon: '✗' }
      default:
        return { color: 'gray', text: 'Unknown', icon: '?' }
    }
  }

  // Get unique categories
  const categories = Array.from(new Set(comparisons.map(comp => comp.product.category).filter(Boolean)))

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  if (!user) {
    router.push('/login')
    return null
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Shopify vs Local Inventory</h1>
                <p className="mt-2 text-gray-600">
                  Compare and sync inventory between your local database and Shopify stores
                </p>
              </div>
              <div className="mt-4 sm:mt-0">
                <div className="text-sm text-gray-500">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">📦</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Products</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalProducts.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">✓</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">In Sync</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {comparisons.filter(c => c.status === 'in_sync').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">↑</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Local Higher</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {comparisons.filter(c => c.status === 'local_higher').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">✗</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Not Found</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {comparisons.filter(c => c.status === 'not_found').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connected Stores */}
          {stores.length > 0 && (
            <div className="bg-white rounded-lg shadow mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Connected Shopify Stores</h3>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap gap-3">
                  {stores.map(store => (
                    <div key={store.id} className="flex items-center px-4 py-2 bg-green-100 rounded-full">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-sm font-medium text-green-800">{store.store_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                {/* Search */}
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Products</label>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by SKU or product name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="in_sync">In Sync</option>
                    <option value="local_higher">Local Higher</option>
                    <option value="shopify_higher">Shopify Higher</option>
                    <option value="not_found">Not Found</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="smart">Smart (Shopify products first)</option>
                    <option value="name">Product Name</option>
                    <option value="sku">SKU</option>
                    <option value="category">Category</option>
                    <option value="difference">Difference</option>
                  </select>
                </div>
              </div>

              {/* Sync All Products Button */}
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg mb-4">
                <div>
                  <h4 className="text-sm font-medium text-green-800">Sync All Products</h4>
                  <p className="text-xs text-green-600 mt-1">
                    Sync all {comparisons.length} products on this page one by one with rate limiting
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={loadData}
                    disabled={loadingData}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingData ? (
                      <span className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Refreshing...
                      </span>
                    ) : (
                      '🔄 Refresh Data'
                    )}
                  </button>
                  <button
                    onClick={syncAllProductsOnPage}
                    disabled={syncAllProducts || comparisons.length === 0}
                    className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncAllProducts ? (
                      <span className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Syncing {syncAllProgress.current}/{syncAllProgress.total}...
                      </span>
                    ) : (
                      `Sync All Products (${comparisons.length})`
                    )}
                  </button>
                </div>
              </div>

              {/* Progress Bar for Sync All */}
              {syncAllProducts && (
                <div className="mb-4 p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-800">Syncing Products...</span>
                    <span className="text-sm text-green-600">
                      {syncAllProgress.current}/{syncAllProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-green-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(syncAllProgress.current / syncAllProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-green-600">
                    <span>✅ Success: {syncAllProgress.success}</span>
                    <span>❌ Failed: {syncAllProgress.failed}</span>
                    <span>⏱️ Rate: 4.5s per product</span>
                  </div>
                </div>
              )}

              {/* Bulk Actions */}
              {selectedProducts.size > 0 && (
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-800">
                    {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected
                  </div>
                  <button
                    onClick={bulkSyncSelected}
                    disabled={bulkSyncing || syncAllProducts}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bulkSyncing ? (
                      <span className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Syncing {bulkSyncProgress.current}/{bulkSyncProgress.total}...
                      </span>
                    ) : (
                      `Sync Selected (${selectedProducts.size})`
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-red-400">❌</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loadingData && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading inventory comparison...</p>
              </div>
            </div>
          )}

          {/* Products List */}
          {!loadingData && (
            <div className="bg-white rounded-lg shadow">
              {comparisons.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-gray-400 text-6xl mb-4">📦</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                  <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectAll}
                            onChange={handleSelectAll}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Local Qty
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Shopify Qty
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Variants
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
                      {comparisons.map((comparison) => {
                        const statusInfo = getStatusInfo(comparison.status)
                        const isSyncing = syncingProducts.has(comparison.product.id)
                        const syncResult = syncResults[comparison.product.id]
                        
                        return (
                          <tr key={comparison.product.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedProducts.has(comparison.product.id)}
                                onChange={() => handleSelectProduct(comparison.product.id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-12 w-12">
                                  {comparison.product.image_url ? (
                                    <img
                                      className="h-12 w-12 rounded-lg object-cover"
                                      src={comparison.product.image_url}
                                      alt={comparison.product.product_name}
                                    />
                                  ) : (
                                    <div className="h-12 w-12 rounded-lg bg-gray-200 flex items-center justify-center">
                                      <span className="text-gray-400">📦</span>
                                    </div>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {comparison.product.product_name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    SKU: {comparison.product.sku}
                                  </div>
                                  {comparison.product.category && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                                      {comparison.product.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {comparison.local_quantity}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {comparison.total_shopify_quantity}
                              </div>
                              <div className="text-xs text-gray-500">
                                {Object.values(comparison.shopify_quantities).map((qty, index) => (
                                  <div key={index}>
                                    {qty.store_name}: {qty.quantity} units
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {comparison.total_variants_found}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm font-medium ${
                                comparison.difference > 0 ? 'text-green-600' : 
                                comparison.difference < 0 ? 'text-red-600' : 'text-gray-900'
                              }`}>
                                {comparison.difference > 0 ? '+' : ''}{comparison.difference}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${statusInfo.color}-100 text-${statusInfo.color}-800`}>
                                <span className="mr-1">{statusInfo.icon}</span>
                                {statusInfo.text}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {isSyncing ? (
                                <div className="flex items-center text-blue-600">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                  Syncing...
                                </div>
                              ) : (
                                <button
                                  onClick={() => syncProduct(comparison.product)}
                                  disabled={syncAllProducts}
                                  className={`mr-3 ${
                                    syncAllProducts 
                                      ? 'text-gray-400 cursor-not-allowed' 
                                      : 'text-blue-600 hover:text-blue-900'
                                  }`}
                                >
                                  🔄 Sync All
                                </button>
                              )}
                              
                              {syncResult && (
                                <div className="mt-2 text-xs">
                                  {syncResult.success ? (
                                    <span className="text-green-600">✅ Success</span>
                                  ) : (
                                    <span className="text-red-600">❌ Failed</span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg shadow mt-8">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={!pagination.hasPrev}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.totalPages))}
                  disabled={!pagination.hasNext}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">
                      {(pagination.page - 1) * pagination.limit + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>{' '}
                    of{' '}
                    <span className="font-medium">{pagination.total}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={!pagination.hasPrev}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pagination.page === pageNum
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.totalPages))}
                      disabled={!pagination.hasNext}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}