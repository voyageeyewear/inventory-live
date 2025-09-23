import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Package,
  Plus,
  Minus,
  Edit,
  Eye,
  Filter,
  Download,
  RefreshCw,
  Bell,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingDown,
  TrendingUp,
  BarChart3,
  ShoppingCart,
  DollarSign,
  Calendar,
  Mail,
  MessageSquare,
} from 'lucide-react'
import Layout from '../components/Layout'
import axios from 'axios'
import toast from 'react-hot-toast'

interface LowStockProduct {
  id: string
  sku: string
  product_name: string
  category: string
  current_stock: number
  minimum_threshold: number
  price: number
  last_updated: string
  days_since_update: number
  stock_status: 'critical' | 'low' | 'warning'
  estimated_days_remaining: number
  average_daily_usage: number
  last_sale_date: string
  reorder_suggestion: number
  total_value: number
  supplier_info?: {
    name: string
    contact: string
    lead_time: number
  }
}

interface AlertSummary {
  total_low_stock_products: number
  critical_stock_products: number
  low_stock_products: number
  warning_stock_products: number
  total_value_at_risk: number
  products_needing_immediate_attention: number
  average_days_until_out_of_stock: number
  top_categories_at_risk: { category: string; count: number; value: number }[]
}

export default function LowQuantityAlert() {
  const [products, setProducts] = useState<LowStockProduct[]>([])
  const [summary, setSummary] = useState<AlertSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [alertThreshold, setAlertThreshold] = useState(10)
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'stock_level' | 'days_remaining' | 'value' | 'last_updated'>('stock_level')
  const [showOnlyCritical, setShowOnlyCritical] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)

  // Fetch low stock data
  const fetchLowStockData = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/alerts/low-stock?threshold=${alertThreshold}&status=${stockStatusFilter}&category=${categoryFilter}&sortBy=${sortBy}&criticalOnly=${showOnlyCritical}`)
      setProducts(response.data.products)
      setSummary(response.data.summary)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch low stock data')
    } finally {
      setLoading(false)
    }
  }

  // Export data
  const exportData = () => {
    const csvContent = [
      ['SKU', 'Product Name', 'Category', 'Current Stock', 'Minimum Threshold', 'Stock Status', 'Days Remaining', 'Value', 'Last Updated'],
      ...products.map(product => [
        product.sku,
        product.product_name,
        product.category,
        product.current_stock.toString(),
        product.minimum_threshold.toString(),
        product.stock_status,
        product.estimated_days_remaining.toString(),
        product.total_value.toString(),
        new Date(product.last_updated).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `low-stock-alert-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('Low stock alert exported successfully')
  }

  // Send email alerts
  const sendEmailAlerts = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select products to send alerts for')
      return
    }

    try {
      setLoading(true)
      await axios.post('/api/alerts/send-email', {
        productIds: selectedProducts,
        type: 'low_stock'
      })
      toast.success(`Email alerts sent for ${selectedProducts.length} products`)
      setSelectedProducts([])
      setShowBulkActions(false)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send email alerts')
    } finally {
      setLoading(false)
    }
  }

  // Bulk update stock
  const bulkUpdateStock = async (action: 'increase' | 'decrease', amount: number) => {
    if (selectedProducts.length === 0) {
      toast.error('Please select products to update')
      return
    }

    try {
      setLoading(true)
      await axios.post('/api/alerts/bulk-update-stock', {
        productIds: selectedProducts,
        action,
        amount
      })
      toast.success(`Stock updated for ${selectedProducts.length} products`)
      setSelectedProducts([])
      setShowBulkActions(false)
      fetchLowStockData()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update stock')
    } finally {
      setLoading(false)
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount)
  }

  // Format number
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num)
  }

  // Get stock status badge
  const getStockBadge = (status: string) => {
    switch (status) {
      case 'critical':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Critical</span>
      case 'low':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" />Low</span>
      case 'warning':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><Clock className="h-3 w-3 mr-1" />Warning</span>
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>
    }
  }

  // Get urgency color
  const getUrgencyColor = (daysRemaining: number) => {
    if (daysRemaining <= 0) return 'text-red-600 bg-red-50'
    if (daysRemaining <= 3) return 'text-red-500 bg-red-25'
    if (daysRemaining <= 7) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  // Toggle product selection
  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  // Select all products
  const selectAllProducts = () => {
    setSelectedProducts(products.map(p => p.id))
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedProducts([])
  }

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))]

  useEffect(() => {
    fetchLowStockData()
  }, [alertThreshold, stockStatusFilter, categoryFilter, sortBy, showOnlyCritical])

  useEffect(() => {
    setShowBulkActions(selectedProducts.length > 0)
  }, [selectedProducts])

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading low stock alerts...</span>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Low Quantity Alert</h1>
            <p className="mt-1 text-sm text-gray-600">
              Monitor and manage low stock products
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <button
              onClick={exportData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            <button
              onClick={fetchLowStockData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Alert Summary */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-red-600 truncate">Critical Stock</dt>
                    <dd className="text-lg font-medium text-red-900">{summary.critical_stock_products}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-yellow-600 truncate">Low Stock</dt>
                    <dd className="text-lg font-medium text-yellow-900">{summary.low_stock_products}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-orange-600 truncate">Warning Stock</dt>
                    <dd className="text-lg font-medium text-orange-900">{summary.warning_stock_products}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-blue-600 truncate">Value at Risk</dt>
                    <dd className="text-lg font-medium text-blue-900">{formatCurrency(summary.total_value_at_risk)}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alert Threshold</label>
              <input
                type="number"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                min="1"
                max="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock Status</label>
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="critical">Critical</option>
                <option value="low">Low</option>
                <option value="warning">Warning</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.slice(1).map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="stock_level">Stock Level</option>
                <option value="days_remaining">Days Remaining</option>
                <option value="value">Value</option>
                <option value="last_updated">Last Updated</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showOnlyCritical}
                  onChange={(e) => setShowOnlyCritical(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Critical Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {showBulkActions && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bell className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-900">
                  {selectedProducts.length} products selected
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={sendEmailAlerts}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Alerts
                </button>
                <button
                  onClick={() => bulkUpdateStock('increase', 50)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stock
                </button>
                <button
                  onClick={clearSelection}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Low Stock Products</h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAllProducts}
                  className="text-sm text-blue-600 hover:text-blue-900"
                >
                  Select All
                </button>
                <button
                  onClick={clearSelection}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Clear Selection
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Remaining</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                          <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatNumber(product.current_stock)}</div>
                        <div className="text-sm text-gray-500">Min: {formatNumber(product.minimum_threshold)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStockBadge(product.stock_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(product.estimated_days_remaining)}`}>
                          {product.estimated_days_remaining <= 0 ? 'Out of Stock' : `${product.estimated_days_remaining} days`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(product.total_value)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(product.last_updated).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button className="text-blue-600 hover:text-blue-900">
                            <Plus className="h-4 w-4" />
                          </button>
                          <button className="text-green-600 hover:text-green-900">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button className="text-gray-600 hover:text-gray-900">
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
        </div>

        {/* Top Categories at Risk */}
        {summary && summary.top_categories_at_risk.length > 0 && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Top Categories at Risk</h3>
              <div className="space-y-3">
                {summary.top_categories_at_risk.map((category, index) => (
                  <div key={category.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        index === 0 ? 'bg-red-500' :
                        index === 1 ? 'bg-orange-500' :
                        index === 2 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      <span className="text-sm font-medium text-gray-900">{category.category}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{category.count} products</div>
                      <div className="text-xs text-gray-500">{formatCurrency(category.value)} at risk</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
