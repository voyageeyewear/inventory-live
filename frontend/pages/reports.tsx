import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { 
  FileText, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Package,
  Store,
  Activity,
  BarChart3,
  PieChart,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  ShoppingCart,
  Eye,
  ArrowUpDown,
  Target,
  Zap,
  Database,
  FileBarChart,
  Printer
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface ReportStats {
  totalProducts: number
  totalQuantity: number
  lowStockCount: number
  outOfStockCount: number
  totalStockValue: number
  totalUsers: number
  totalTransactions: number
  recentScans: number
}

interface StockMovement {
  id: number
  product_name: string
  sku: string
  action: 'stock_in' | 'stock_out'
  quantity: number
  previous_quantity: number
  new_quantity: number
  notes: string
  created_at: string
  user_id: number
}

interface ProductReport {
  id: number
  product_name: string
  sku: string
  quantity: number
  price: number
  category: string
  last_updated: string
  total_stock_in: number
  total_stock_out: number
  net_movement: number
}

interface ScanActivity {
  id: number
  barcode: string
  product_name: string
  sku: string
  scanned_at: string
  user_id: number
  location: string
}

interface UserActivity {
  id: number
  username: string
  email: string
  role: string
  last_login: string
  total_actions: number
  recent_activity: string
}

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  // Data states
  const [stats, setStats] = useState<ReportStats>({
    totalProducts: 0,
    totalQuantity: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalStockValue: 0,
    totalUsers: 0,
    totalTransactions: 0,
    recentScans: 0
  })
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [productReports, setProductReports] = useState<ProductReport[]>([])
  const [scanActivities, setScanActivities] = useState<ScanActivity[]>([])
  const [userActivities, setUserActivities] = useState<UserActivity[]>([])
  const [filters, setFilters] = useState({
    category: '',
    action: '',
    user: '',
    search: ''
  })

  const fetchReportsData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        ...filters
      })

      const [
        productsRes,
        stockLogsRes,
        scanLogsRes,
        usersRes
      ] = await Promise.allSettled([
        axios.get('/api/products'),
        axios.get(`/api/stock-logs?${params}`),
        axios.get(`/api/scan-logs?${params}`),
        axios.get('/api/users').catch(() => ({ data: [] }))
      ])

      // Process products data
      const products = productsRes.status === 'fulfilled' ? productsRes.value.data : []
      const stockLogs = stockLogsRes.status === 'fulfilled' ? stockLogsRes.value.data.stockLogs || [] : []
      const scanLogs = scanLogsRes.status === 'fulfilled' ? scanLogsRes.value.data.scanLogs || [] : []
      const users = usersRes.status === 'fulfilled' ? usersRes.value.data : []

      // Calculate statistics
      const totalProducts = products.length
      const totalQuantity = products.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0)
      const lowStockCount = products.filter((p: any) => (p.quantity || 0) < 10).length
      const outOfStockCount = products.filter((p: any) => (p.quantity || 0) === 0).length
      const totalStockValue = products.reduce((sum: number, p: any) => sum + ((p.quantity || 0) * (p.price || 0)), 0)

      setStats({
        totalProducts,
        totalQuantity,
        lowStockCount,
        outOfStockCount,
        totalStockValue,
        totalUsers: users.length,
        totalTransactions: stockLogs.length,
        recentScans: scanLogs.length
      })

      // Process stock movements
      const processedStockLogs = stockLogs.map((log: any) => ({
        id: log.id,
        product_name: log.product_name || 'Unknown Product',
        sku: log.sku || 'N/A',
        action: log.action,
        quantity: log.quantity,
        previous_quantity: log.previous_quantity || 0,
        new_quantity: log.new_quantity || 0,
        notes: log.notes || '',
        created_at: log.created_at,
        user_id: log.user_id || 0
      }))
      setStockMovements(processedStockLogs)

      // Process product reports with movement data
      const productReportsData = products.map((product: any) => {
        const productStockLogs = stockLogs.filter((log: any) => log.sku === product.sku)
        const stockIn = productStockLogs
          .filter((log: any) => log.action === 'stock_in')
          .reduce((sum: number, log: any) => sum + (log.quantity || 0), 0)
        const stockOut = productStockLogs
          .filter((log: any) => log.action === 'stock_out')
          .reduce((sum: number, log: any) => sum + (log.quantity || 0), 0)

        return {
          id: product.id,
          product_name: product.product_name,
          sku: product.sku,
          quantity: product.quantity || 0,
          price: product.price || 0,
          category: product.category || 'Uncategorized',
          last_updated: product.updated_at || product.created_at,
          total_stock_in: stockIn,
          total_stock_out: stockOut,
          net_movement: stockIn - stockOut
        }
      })
      setProductReports(productReportsData)

      // Process scan activities
      const processedScanLogs = scanLogs.map((log: any) => ({
        id: log.id,
        barcode: log.barcode || 'N/A',
        product_name: log.product_name || 'Unknown Product',
        sku: log.sku || 'N/A',
        scanned_at: log.created_at,
        user_id: log.user_id || 0,
        location: log.location || 'Unknown'
      }))
      setScanActivities(processedScanLogs)

      // Process user activities
      const processedUsers = users.map((user: any) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        last_login: user.last_login || user.updated_at,
        total_actions: stockLogs.filter((log: any) => log.user_id === user.id).length,
        recent_activity: user.updated_at
      }))
      setUserActivities(processedUsers)

    } catch (error: any) {
      toast.error('Failed to fetch reports data')
      console.error('Reports fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReportsData()
  }, [dateRange])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const exportReport = (type: string) => {
    let data: any = {}
    let filename = `${type}_report_${new Date().toISOString().split('T')[0]}`

    switch (type) {
      case 'overview':
        data = {
          generated_at: new Date().toISOString(),
          date_range: dateRange,
          statistics: stats,
          summary: 'Complete inventory overview report'
        }
        break
      case 'stock_movements':
        data = {
          generated_at: new Date().toISOString(),
          date_range: dateRange,
          movements: stockMovements,
          total_movements: stockMovements.length
        }
        break
      case 'products':
        data = {
          generated_at: new Date().toISOString(),
          products: productReports,
          total_products: productReports.length,
          total_value: stats.totalStockValue
        }
        break
      case 'scans':
        data = {
          generated_at: new Date().toISOString(),
          date_range: dateRange,
          scan_activities: scanActivities,
          total_scans: scanActivities.length
        }
        break
      case 'users':
        data = {
          generated_at: new Date().toISOString(),
          user_activities: userActivities,
          total_users: userActivities.length
        }
        break
    }

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(`${type.replace('_', ' ').toUpperCase()} report exported successfully`)
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'stock_movements', name: 'Stock Movements', icon: ArrowUpDown },
    { id: 'products', name: 'Product Reports', icon: Package },
    { id: 'scans', name: 'Scan Activity', icon: Activity },
    { id: 'users', name: 'User Activity', icon: Users },
    { id: 'analytics', name: 'Analytics', icon: PieChart }
  ]

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileBarChart className="h-8 w-8 text-blue-600" />
              Reports & Analytics
            </h1>
            <p className="text-gray-600 mt-1">Comprehensive inventory reports and business intelligence</p>
          </div>
          
          {/* Date Range Filter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={fetchReportsData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading reports...</span>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-center">
                      <Package className="h-10 w-10 text-blue-600 bg-blue-100 rounded-lg p-2" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Products</p>
                        <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalProducts)}</p>
                        <p className="text-xs text-gray-500 mt-1">Active inventory items</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-center">
                      <Database className="h-10 w-10 text-green-600 bg-green-100 rounded-lg p-2" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                        <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalQuantity)}</p>
                        <p className="text-xs text-gray-500 mt-1">Units in stock</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-center">
                      <DollarSign className="h-10 w-10 text-purple-600 bg-purple-100 rounded-lg p-2" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Stock Value</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalStockValue)}</p>
                        <p className="text-xs text-gray-500 mt-1">Total inventory value</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-center">
                      <ShoppingCart className="h-10 w-10 text-orange-600 bg-orange-100 rounded-lg p-2" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Transactions</p>
                        <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalTransactions)}</p>
                        <p className="text-xs text-gray-500 mt-1">Stock movements</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <AlertTriangle className="h-8 w-8 text-yellow-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Low Stock</p>
                        <p className="text-2xl font-bold text-yellow-600">{formatNumber(stats.lowStockCount)}</p>
                      </div>
                      </div>
                      </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <TrendingDown className="h-8 w-8 text-red-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                        <p className="text-2xl font-bold text-red-600">{formatNumber(stats.outOfStockCount)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-teal-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Active Users</p>
                        <p className="text-2xl font-bold text-teal-600">{formatNumber(stats.totalUsers)}</p>
                      </div>
                    </div>
                      </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                      <Activity className="h-8 w-8 text-purple-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Recent Scans</p>
                        <p className="text-2xl font-bold text-purple-600">{formatNumber(stats.recentScans)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Download className="h-5 w-5 text-blue-600" />
                    Export Reports
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button
                      onClick={() => exportReport('overview')}
                      className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">Overview Report</div>
                        <div className="text-sm text-gray-500">Complete statistics summary</div>
                      </div>
                    </button>
                    <button
                      onClick={() => exportReport('stock_movements')}
                      className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ArrowUpDown className="h-6 w-6 text-green-600" />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">Stock Movements</div>
                        <div className="text-sm text-gray-500">All inventory transactions</div>
                      </div>
                    </button>
                    <button
                      onClick={() => exportReport('products')}
                      className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Package className="h-6 w-6 text-purple-600" />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">Product Report</div>
                        <div className="text-sm text-gray-500">Detailed product analysis</div>
              </div>
                    </button>
                </div>
                </div>
              </div>
            )}

            {/* Stock Movements Tab */}
            {activeTab === 'stock_movements' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Stock Movement History</h2>
                  <button
                    onClick={() => exportReport('stock_movements')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Before → After</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {stockMovements.slice(0, 50).map((movement) => (
                          <tr key={movement.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{movement.product_name}</div>
                                <div className="text-sm text-gray-500">SKU: {movement.sku}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                movement.action === 'stock_in' 
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {movement.action === 'stock_in' ? 'Stock In' : 'Stock Out'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <span className={movement.action === 'stock_in' ? 'text-green-600' : 'text-red-600'}>
                                {movement.action === 'stock_in' ? '+' : '-'}{formatNumber(movement.quantity)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatNumber(movement.previous_quantity)} → {formatNumber(movement.new_quantity)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(movement.created_at)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                              {movement.notes || 'No notes'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}

            {/* Product Reports Tab */}
            {activeTab === 'products' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Product Performance Report</h2>
                  <button
                    onClick={() => exportReport('products')}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock In</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Out</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Movement</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {productReports.slice(0, 50).map((product) => (
                          <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                                <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{formatNumber(product.quantity)}</div>
                              <div className={`text-xs ${
                                product.quantity === 0 ? 'text-red-500' :
                                product.quantity < 10 ? 'text-yellow-500' : 'text-green-500'
                              }`}>
                                {product.quantity === 0 ? 'Out of Stock' :
                                 product.quantity < 10 ? 'Low Stock' : 'In Stock'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(product.quantity * product.price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                              +{formatNumber(product.total_stock_in)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                              -{formatNumber(product.total_stock_out)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <span className={product.net_movement >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {product.net_movement >= 0 ? '+' : ''}{formatNumber(product.net_movement)}
                            </span>
                          </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                {product.category}
                              </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}

            {/* Scan Activity Tab */}
            {activeTab === 'scans' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Barcode Scan Activity</h2>
                  <button
                    onClick={() => exportReport('scans')}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                  </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barcode</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scanned At</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {scanActivities.slice(0, 50).map((scan) => (
                          <tr key={scan.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{scan.product_name}</div>
                                <div className="text-sm text-gray-500">SKU: {scan.sku}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                              {scan.barcode}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(scan.scanned_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {scan.location}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              User #{scan.user_id}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* User Activity Tab */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">User Activity Report</h2>
                  <button
                    onClick={() => exportReport('users')}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                    </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Actions</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Activity</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {userActivities.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{user.username}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                              </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                user.role === 'admin' 
                                  ? 'bg-purple-100 text-purple-800'
                                  : user.role === 'manager'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {user.role}
                              </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatNumber(user.total_actions)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.last_login ? formatDate(user.last_login) : 'Never'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(user.recent_activity)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="text-center py-12">
                  <PieChart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">Advanced Analytics</h3>
                  <p className="text-gray-500 mb-6">Coming soon - Advanced charts, trends, and predictive analytics</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <Target className="h-8 w-8 text-blue-600 mb-3" />
                      <h4 className="font-medium text-gray-900 mb-2">Sales Forecasting</h4>
                      <p className="text-sm text-gray-500">Predict future inventory needs based on historical data</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <TrendingUp className="h-8 w-8 text-green-600 mb-3" />
                      <h4 className="font-medium text-gray-900 mb-2">Trend Analysis</h4>
                      <p className="text-sm text-gray-500">Identify patterns in product movement and demand</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                      <Zap className="h-8 w-8 text-purple-600 mb-3" />
                      <h4 className="font-medium text-gray-900 mb-2">Performance Metrics</h4>
                      <p className="text-sm text-gray-500">Track KPIs and operational efficiency metrics</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}