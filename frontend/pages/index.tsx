import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { Upload, Package, Eye, RefreshCw, CheckSquare, Square, History, X, Edit, Save, Trash2 } from 'lucide-react'
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

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [productsPerPage] = useState(10)
  const [editingProduct, setEditingProduct] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    product_name: '',
    category: '',
    price: '',
    quantity: '',
    description: '',
    image_url: ''
  })

  const { user, isFullyAuthenticated } = useAuth()

  useEffect(() => {
    if (isFullyAuthenticated) {
      console.log('Products: Making API call - fully authenticated')
      fetchProducts()
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      setUploading(true)
      const response = await axios.post('/api/products/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      
      toast.success(`Successfully uploaded ${response.data.count} products`)
      fetchProducts()
      
      // Reset file input
      event.target.value = ''
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload CSV')
      // Reset file input
      event.target.value = ''
    } finally {
      setUploading(false)
    }
  }

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
      
      // Refresh sync status
      if ((window as any).refreshSyncStatus) {
        (window as any).refreshSyncStatus()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to sync products')
    } finally {
      setSyncing(false)
    }
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product.id.toString())
    setEditForm({
      product_name: product.product_name,
      category: product.category || '',
      price: product.price || '0.00',
      quantity: product.quantity.toString(),
      description: product.description || '',
      image_url: product.image_url || ''
    })
  }

  const handleSaveEdit = async (productId: string) => {
    if (!editForm.product_name || !editForm.quantity) {
      toast.error('Product name and quantity are required')
      return
    }

    try {
      const response = await axios.put(`/api/products/${productId}`, {
        sku: products.find(p => p.id.toString() === productId)?.sku,
        product_name: editForm.product_name,
        category: editForm.category,
        price: parseFloat(editForm.price) || 0,
        quantity: parseInt(editForm.quantity),
        description: editForm.description,
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
      category: '',
      price: '',
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
      return // User cancelled
    }

    // Second confirmation
    const secondConfirm = window.confirm(
      `🚨 FINAL CONFIRMATION 🚨\n\n` +
      `This is your LAST CHANCE to cancel!\n\n` +
      `Clicking 'OK' will permanently delete:\n` +
      `"${product.product_name}" (${product.sku})\n\n` +
      `✅ I understand this product will be permanently deleted\n` +
      `✅ I understand this action cannot be undone\n` +
      `✅ I want to proceed with deletion\n\n` +
      `Are you absolutely sure?`
    )

    if (!secondConfirm) {
      return // User cancelled
    }

    try {
      await axios.delete(`/api/products/${product.id}`)
      toast.success(`Product "${product.product_name}" deleted successfully!`)
      fetchProducts() // Refresh the product list
      
      // Instantly refresh sync status
      if ((window as any).refreshSyncStatus) {
        (window as any).refreshSyncStatus()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete product')
    }
  }

  const handleEditInputChange = (field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
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

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  return (
    <ProtectedRoute requiredPermission="viewProducts">
      <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600">Upload and manage your product inventory</p>
          </div>
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

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

        {/* Search and Actions */}
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
            <div className="flex gap-2">
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
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Product Inventory
              </h3>
              <span className="text-sm text-gray-500">
                {filteredProducts.length} of {products.length} products
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading products...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search terms.' : 'Get started by uploading a CSV file.'}
              </p>
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
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {selectedProducts.size === filteredProducts.length ? (
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
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
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
                            <div>
                              <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                              {product.description && (
                                <div className="text-sm text-gray-500 truncate max-w-48">{product.description}</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{product.sku}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingProduct === product.id.toString() ? (
                            <input
                              type="text"
                              value={editForm.category}
                              onChange={(e) => handleEditInputChange('category', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-sm text-gray-900">{product.category || '-'}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingProduct === product.id.toString() ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editForm.price}
                              onChange={(e) => handleEditInputChange('price', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="text-sm text-gray-900">${product.price}</span>
                          )}
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
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              product.quantity === 0 
                                ? 'bg-red-100 text-red-800' 
                                : product.quantity < 10 
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {product.quantity}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
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
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product)}
                                  className="text-red-600 hover:text-red-900 flex items-center gap-1"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
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
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{indexOfFirstProduct + 1}</span> to{' '}
                        <span className="font-medium">
                          {Math.min(indexOfLastProduct, filteredProducts.length)}
                        </span>{' '}
                        of <span className="font-medium">{filteredProducts.length}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => paginate(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                          <button
                            key={number}
                            onClick={() => paginate(number)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === number
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {number}
                          </button>
                        ))}
                        <button
                          onClick={() => paginate(currentPage + 1)}
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
    </ProtectedRoute>
  )
}