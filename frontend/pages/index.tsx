import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { Upload, Package, Eye, RefreshCw, CheckSquare, Square, History, X, Edit, Save, Cancel } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface Product {
  _id: string
  sku: string
  product_name: string
  quantity: number
  image_url?: string
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [syncingProduct, setSyncingProduct] = useState<string | null>(null)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [auditProduct, setAuditProduct] = useState<string | null>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const [editingProduct, setEditingProduct] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    product_name: '',
    quantity: '',
    image_url: ''
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await axios.get('/api/products')
      setProducts(response.data)
    } catch (error) {
      toast.error('Failed to fetch products')
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
    const formData = new FormData()
    formData.append('csv', file)

    try {
      const response = await axios.post('/api/products/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      toast.success(`Successfully uploaded ${response.data.count} products`)
      fetchProducts()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p._id)))
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
        .filter(p => selectedProducts.has(p._id))
        .map(p => p.sku)

      const response = await axios.post('/api/sync/multi', { skus: selectedSkus })
      toast.success(`Successfully synced ${selectedProducts.size} products`)
      setSelectedProducts(new Set())
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncSingle = async (sku: string) => {
    setSyncingProduct(sku)
    try {
      const response = await axios.post('/api/sync/test-one', { sku })
      if (response.data.success) {
        toast.success(`Successfully synced ${sku}`)
      } else {
        toast.error(`Failed to sync ${sku}`)
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Sync failed')
    } finally {
      setSyncingProduct(null)
    }
  }

  const handleViewAudit = async (sku: string) => {
    setAuditProduct(sku)
    setShowAuditModal(true)
    
    try {
      const response = await axios.get(`/api/audit/product/${sku}`)
      setAuditLogs(response.data.data.logs || [])
    } catch (error) {
      toast.error('Failed to fetch audit logs')
      setAuditLogs([])
    }
  }

  // Filter and paginate products
  const filteredProducts = products.filter(product =>
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'sync_success': return 'text-green-600'
      case 'sync_failed': return 'text-red-600'
      case 'stock_in': return 'text-blue-600'
      case 'stock_out': return 'text-orange-600'
      default: return 'text-gray-600'
    }
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product._id)
    setEditForm({
      product_name: product.product_name,
      quantity: product.quantity.toString(),
      image_url: product.image_url || ''
    })
  }

  const handleSaveEdit = async (productId: string) => {
    if (!editForm.product_name || !editForm.quantity) {
      toast.error('Product name and quantity are required')
      return
    }

    if (isNaN(Number(editForm.quantity)) || Number(editForm.quantity) < 0) {
      toast.error('Quantity must be a valid number')
      return
    }

    try {
      const response = await axios.put(`/api/products/${productId}`, {
        product_name: editForm.product_name,
        quantity: parseInt(editForm.quantity),
        image_url: editForm.image_url
      })

      toast.success('Product updated successfully!')
      setEditingProduct(null)
      fetchProducts() // Refresh the product list
      
      // Instantly refresh sync status
      if ((window as any).refreshSyncStatus) {
        (window as any).refreshSyncStatus()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update product')
    }
  }

  const handleCancelEdit = () => {
    setEditingProduct(null)
    setEditForm({
      product_name: '',
      quantity: '',
      image_url: ''
    })
  }

  const handleEditInputChange = (field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600">Upload and manage your product inventory</p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="card">
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
                  <input
                    id="csv-upload"
                    name="csv-upload"
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <span className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700">
                    {uploading ? 'Uploading...' : 'Choose File'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Product Inventory</h2>
            <div className="flex items-center gap-4">
              {/* Search */}
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Package className="h-4 w-4" />
                {filteredProducts.length} of {products.length} products
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedProducts.size > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-800">
                  {selectedProducts.size} product{selectedProducts.size > 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleSyncSelected}
                    disabled={syncing}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Selected'}
                  </button>
                  <button
                    onClick={() => setSelectedProducts(new Set())}
                    className="btn-secondary text-sm"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">No products found. Upload a CSV to get started.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={handleSelectAll}
                          className="flex items-center gap-2 hover:text-gray-700"
                        >
                          {selectedProducts.size === filteredProducts.length ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                          Select
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
                        Image
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedProducts.map((product) => (
                      <tr key={product._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleSelectProduct(product._id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {selectedProducts.has(product._id) ? (
                              <CheckSquare className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          {editingProduct === product._id ? (
                            <input
                              type="text"
                              value={editForm.product_name}
                              onChange={(e) => handleEditInputChange('product_name', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                              {product.product_name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-mono">{product.sku}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingProduct === product._id ? (
                            <input
                              type="number"
                              value={editForm.quantity}
                              onChange={(e) => handleEditInputChange('quantity', e.target.value)}
                              min="0"
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              product.quantity > 10 
                                ? 'bg-green-100 text-green-800' 
                                : product.quantity > 0
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {product.quantity}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingProduct === product._id ? (
                            <input
                              type="url"
                              value={editForm.image_url}
                              onChange={(e) => handleEditInputChange('image_url', e.target.value)}
                              placeholder="Image URL"
                              className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.product_name}
                                className="h-10 w-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 bg-gray-200 rounded-lg flex items-center justify-center">
                                <Eye className="h-4 w-4 text-gray-400" />
                              </div>
                            )
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            {editingProduct === product._id ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(product._id)}
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
                                  className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleSyncSingle(product.sku)}
                                  disabled={syncingProduct === product.sku}
                                  className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                                >
                                  <RefreshCw className={`h-4 w-4 ${syncingProduct === product.sku ? 'animate-spin' : ''}`} />
                                  Sync
                                </button>
                                <button
                                  onClick={() => handleViewAudit(product.sku)}
                                  className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
                                >
                                  <History className="h-4 w-4" />
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-6 py-3 bg-gray-50 border-t">
                  <div className="text-sm text-gray-700">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredProducts.length)} of {filteredProducts.length} products
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Audit Modal */}
        {showAuditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  Audit History - {auditProduct}
                </h3>
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-96">
                {auditLogs.length > 0 ? (
                  <div className="space-y-4">
                    {auditLogs.map((log, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className={`flex items-center gap-2 ${getActionColor(log.action)}`}>
                            <span className="font-medium capitalize">
                              {log.action.replace('_', ' ')}
                            </span>
                            {log.type === 'sync' && log.store_name && (
                              <span className="text-sm text-gray-500">
                                → {log.store_name}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-gray-500">
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {log.type === 'sync' ? (
                            <div>
                              <p>Quantity: {log.new_quantity}</p>
                              {log.error_message && (
                                <p className="text-red-600 mt-1">Error: {log.error_message}</p>
                              )}
                              {log.sync_duration_ms && (
                                <p className="text-gray-500 mt-1">Duration: {log.sync_duration_ms}ms</p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p>
                                {log.old_quantity} → {log.new_quantity} 
                                <span className={`ml-2 ${log.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ({log.quantity_change > 0 ? '+' : ''}{log.quantity_change})
                                </span>
                              </p>
                              {log.reason && <p className="text-gray-500 mt-1">Reason: {log.reason}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No audit history found for this product.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

