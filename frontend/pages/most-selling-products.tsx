import { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  ShoppingCart,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  BarChart3,
  PieChart,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Clock,
  Star,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import Layout from '../components/Layout'
import axios from 'axios'
import toast from 'react-hot-toast'

interface ProductSales {
  id: string
  sku: string
  product_name: string
  category: string
  total_sales: number
  total_quantity_sold: number
  total_revenue: number
  avg_daily_sales: number
  last_sale_date: string
  current_stock: number
  price: number
  sales_trend: 'up' | 'down' | 'stable'
  growth_percentage: number
  top_selling_days: string[]
  sales_by_month: { month: string; sales: number }[]
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

interface SalesAnalytics {
  total_products_analyzed: number
  top_performing_categories: { category: string; total_sales: number; percentage: number }[]
  total_revenue: number
  total_units_sold: number
  average_order_value: number
  best_selling_day: string
  worst_selling_day: string
  sales_velocity: { fast: number; medium: number; slow: number }
  revenue_trend: 'up' | 'down' | 'stable'
  monthly_revenue: { month: string; revenue: number }[]
}

export default function MostSellingProducts() {
  const [products, setProducts] = useState<ProductSales[]>([])
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [sortBy, setSortBy] = useState<'sales' | 'revenue' | 'quantity' | 'growth'>('sales')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('all')
  const [showCharts, setShowCharts] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<ProductSales | null>(null)

  // Fetch sales data
  const fetchSalesData = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/analytics/most-selling-products?timeRange=${timeRange}&sortBy=${sortBy}&category=${categoryFilter}&stockStatus=${stockStatusFilter}`)
      setProducts(response.data.products)
      setAnalytics(response.data.analytics)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch sales data')
    } finally {
      setLoading(false)
    }
  }

  // Export data
  const exportData = () => {
    const csvContent = [
      ['SKU', 'Product Name', 'Category', 'Total Sales', 'Quantity Sold', 'Revenue', 'Growth %', 'Stock Status'],
      ...products.map(product => [
        product.sku,
        product.product_name,
        product.category,
        product.total_sales.toString(),
        product.total_quantity_sold.toString(),
        product.total_revenue.toString(),
        `${product.growth_percentage}%`,
        product.stock_status
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `most-selling-products-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('Data exported successfully')
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

  // Get trend icon and color
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />
      case 'down':
        return <ArrowDownRight className="h-4 w-4 text-red-600" />
      default:
        return <div className="h-4 w-4 bg-gray-400 rounded-full" />
    }
  }

  // Get stock status badge
  const getStockBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />In Stock</span>
      case 'low_stock':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" />Low Stock</span>
      case 'out_of_stock':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />Out of Stock</span>
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>
    }
  }

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))]

  useEffect(() => {
    fetchSalesData()
  }, [timeRange, sortBy, categoryFilter, stockStatusFilter])

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading sales analytics...</span>
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
            <h1 className="text-2xl font-bold text-gray-900">Most Selling Products</h1>
            <p className="mt-1 text-sm text-gray-600">
              Analyze product performance and sales trends
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <button
              onClick={() => setShowCharts(!showCharts)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              {showCharts ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showCharts ? 'Hide Charts' : 'Show Charts'}
            </button>
            <button
              onClick={exportData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            <button
              onClick={fetchSalesData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="sales">Total Sales</option>
                <option value="revenue">Revenue</option>
                <option value="quantity">Quantity Sold</option>
                <option value="growth">Growth Rate</option>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock Status</label>
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>
        </div>

        {/* Analytics Overview */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                      <dd className="text-lg font-medium text-gray-900">{formatCurrency(analytics.total_revenue)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ShoppingCart className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Units Sold</dt>
                      <dd className="text-lg font-medium text-gray-900">{formatNumber(analytics.total_units_sold)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Package className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Products Analyzed</dt>
                      <dd className="text-lg font-medium text-gray-900">{formatNumber(analytics.total_products_analyzed)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Target className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Avg Order Value</dt>
                      <dd className="text-lg font-medium text-gray-900">{formatCurrency(analytics.average_order_value)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        {showCharts && analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Categories Chart */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performing Categories</h3>
              <div className="space-y-3">
                {analytics.top_performing_categories.slice(0, 5).map((category, index) => (
                  <div key={category.category} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                      }`} />
                      <span className="text-sm font-medium text-gray-700">{category.category}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{formatNumber(category.total_sales)}</div>
                      <div className="text-xs text-gray-500">{category.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales Velocity Chart */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Sales Velocity</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-green-500 mr-3" />
                    <span className="text-sm font-medium text-gray-700">Fast Moving</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900">{analytics.sales_velocity.fast}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-yellow-500 mr-3" />
                    <span className="text-sm font-medium text-gray-700">Medium Moving</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900">{analytics.sales_velocity.medium}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-red-500 mr-3" />
                    <span className="text-sm font-medium text-gray-700">Slow Moving</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900">{analytics.sales_velocity.slow}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Top Selling Products</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Growth</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product, index) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {index < 3 && (
                            <Star className={`h-4 w-4 mr-2 ${
                              index === 0 ? 'text-yellow-500' :
                              index === 1 ? 'text-gray-400' :
                              index === 2 ? 'text-orange-600' : ''
                            }`} />
                          )}
                          <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                          <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatNumber(product.total_sales)}</div>
                        <div className="text-sm text-gray-500">{formatNumber(product.total_quantity_sold)} units</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(product.total_revenue)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getTrendIcon(product.sales_trend)}
                          <span className={`ml-1 text-sm ${
                            product.growth_percentage > 0 ? 'text-green-600' :
                            product.growth_percentage < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {product.growth_percentage > 0 ? '+' : ''}{product.growth_percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStockBadge(product.stock_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Product Details Modal */}
        {selectedProduct && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setSelectedProduct(null)} />
              <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-96 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedProduct.product_name} - Sales Details
                    </h3>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="px-6 py-4 overflow-y-auto max-h-80">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Sales Overview</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Sales:</span>
                          <span className="text-sm font-medium">{formatNumber(selectedProduct.total_sales)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Quantity Sold:</span>
                          <span className="text-sm font-medium">{formatNumber(selectedProduct.total_quantity_sold)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Revenue:</span>
                          <span className="text-sm font-medium">{formatCurrency(selectedProduct.total_revenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Avg Daily Sales:</span>
                          <span className="text-sm font-medium">{selectedProduct.avg_daily_sales.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Stock & Pricing</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Current Stock:</span>
                          <span className="text-sm font-medium">{formatNumber(selectedProduct.current_stock)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Price:</span>
                          <span className="text-sm font-medium">{formatCurrency(selectedProduct.price)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Last Sale:</span>
                          <span className="text-sm font-medium">{new Date(selectedProduct.last_sale_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Growth:</span>
                          <div className="flex items-center">
                            {getTrendIcon(selectedProduct.sales_trend)}
                            <span className={`ml-1 text-sm ${
                              selectedProduct.growth_percentage > 0 ? 'text-green-600' :
                              selectedProduct.growth_percentage < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {selectedProduct.growth_percentage > 0 ? '+' : ''}{selectedProduct.growth_percentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
