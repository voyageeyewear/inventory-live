import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  Activity,
  Users,
  Calendar,
  Download,
  RefreshCw,
  Filter,
  FileText,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Database,
  Zap
} from 'lucide-react'

interface ReportData {
  overview: {
    totalProducts: number
    totalQuantity: number
    transactions: number
    lowStock: number
    outOfStock: number
    activeUsers: number
    recentScans: number
  }
  syncReports: {
    totalSyncs: number
    successfulSyncs: number
    failedSyncs: number
    pendingSyncs: number
    syncSuccessRate: number
    averageSyncTime: number
    lastSyncTime: string
    storesWithIssues: number
  }
  dailyActivity: Array<{
    date: string
    syncs: number
    stockIn: number
    stockOut: number
    scans: number
    total: number
  }>
  mostSelling: Array<{
    sku: string
    product_name: string
    totalSold: number
    totalRevenue: number
    category: string
    lastSaleDate: string
  }>
  leastSelling: Array<{
    sku: string
    product_name: string
    totalSold: number
    category: string
    lastSaleDate: string
    daysSinceLastSale: number
  }>
  syncTimeline: Array<{
    id: string
    timestamp: string
    store: string
    productCount: number
    successCount: number
    failedCount: number
    duration: number
    errors: string[]
  }>
  stockMovements: Array<{
    id: string
    sku: string
    product_name: string
    type: string
    quantity: number
    timestamp: string
    user: string
    notes: string
  }>
  userActivity: Array<{
    user: string
    activities: number
    lastActivity: string
    syncActivities: number
    stockActivities: number
  }>
}

export default function Reports() {
  const { user, token, isFullyAuthenticated } = useAuth()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedDateRange, setSelectedDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [selectedPeriod, setSelectedPeriod] = useState('today')
  const [exporting, setExporting] = useState(false)

  const fetchReportsData = async () => {
    try {
      setLoading(true)
      
      // Debug authentication
      console.log('Reports - Auth status:', {
        hasUser: !!user,
        hasToken: !!token,
        isFullyAuthenticated,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'No token'
      })
      
      const params = new URLSearchParams({
        startDate: selectedDateRange.startDate,
        endDate: selectedDateRange.endDate,
        period: selectedPeriod
      })

      console.log('Reports - Making API call to:', `/api/reports/simple?${params}`)
      const response = await axios.get(`/api/reports/simple?${params}`)
      
      if (response.data.success) {
        setData(response.data.data)
        setError('')
      } else {
        throw new Error(response.data.message || 'Failed to fetch reports data')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch reports data')
      console.error('Reports fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isFullyAuthenticated && token) {
      fetchReportsData()
    } else {
      console.log('Reports - Not authenticated yet, waiting...')
      setLoading(false)
    }
  }, [selectedDateRange, selectedPeriod, isFullyAuthenticated, token])

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    const today = new Date()
    const startDate = new Date()
    
    switch (period) {
      case 'today':
        setSelectedDateRange({
          startDate: today.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        })
        break
      case 'week':
        startDate.setDate(today.getDate() - 7)
        setSelectedDateRange({
          startDate: startDate.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        })
        break
      case 'month':
        startDate.setMonth(today.getMonth() - 1)
        setSelectedDateRange({
          startDate: startDate.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        })
        break
      case 'quarter':
        startDate.setMonth(today.getMonth() - 3)
        setSelectedDateRange({
          startDate: startDate.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        })
        break
      default:
        break
    }
  }

  const handleExportReport = async (reportType: string) => {
    try {
      setExporting(true)
      const params = new URLSearchParams({
        type: reportType,
        startDate: selectedDateRange.startDate,
        endDate: selectedDateRange.endDate
      })

      const response = await axios.get(`/api/reports/export-simple?${params}`, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportType}-report-${selectedDateRange.startDate}-to-${selectedDateRange.endDate}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`${reportType} report exported successfully`)
    } catch (err: any) {
      toast.error('Failed to export report')
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'sync-reports', name: 'Sync Reports', icon: RotateCcw },
    { id: 'stock-movements', name: 'Stock Movements', icon: TrendingUp },
    { id: 'product-reports', name: 'Product Reports', icon: Package },
    { id: 'scan-activity', name: 'Scan Activity', icon: Activity },
    { id: 'user-activity', name: 'User Activity', icon: Users },
    { id: 'analytics', name: 'Analytics', icon: TrendingDown }
  ]

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  if (error) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Reports</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchReportsData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
    <Layout>
        <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
          <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-blue-600" />
              Reports & Analytics
            </h1>
                <p className="text-gray-600 mt-2">Comprehensive inventory reports and business intelligence</p>
          </div>
          
              {/* Date Range and Controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                    value={selectedDateRange.startDate}
                    onChange={(e) => setSelectedDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                    value={selectedDateRange.endDate}
                    onChange={(e) => setSelectedDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
                
                <div className="flex gap-2">
            <button
              onClick={fetchReportsData}
              disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
                </div>
              </div>
            </div>

            {/* Period Quick Filters */}
            <div className="flex gap-2 mt-4">
              {['today', 'week', 'month', 'quarter'].map((period) => (
                <button
                  key={period}
                  onClick={() => handlePeriodChange(period)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedPeriod === period
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
          </div>
        </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                    <Icon className="h-4 w-4" />
                {tab.name}
              </button>
                )
              })}
          </nav>
        </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow-sm border">
            {/* Overview Tab */}
            {activeTab === 'overview' && data && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Overview Dashboard</h2>
                
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Package className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-blue-600">Total Products</p>
                        <p className="text-2xl font-bold text-blue-900">{data.overview.totalProducts.toLocaleString()}</p>
                        <p className="text-xs text-blue-600">Active inventory items</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-green-600">Total Quantity</p>
                        <p className="text-2xl font-bold text-green-900">{data.overview.totalQuantity.toLocaleString()}</p>
                        <p className="text-xs text-green-600">Units in stock</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-orange-100 rounded-lg">
                        <ShoppingCart className="h-6 w-6 text-orange-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-orange-600">Transactions</p>
                        <p className="text-2xl font-bold text-orange-900">{data.overview.transactions.toLocaleString()}</p>
                        <p className="text-xs text-orange-600">Stock movements</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-red-100 rounded-lg">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-red-600">Low Stock</p>
                        <p className="text-2xl font-bold text-red-900">{data.overview.lowStock.toLocaleString()}</p>
                        <p className="text-xs text-red-600">Items need attention</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Daily Activity Chart */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity Trend</h3>
                  <div className="h-64 flex items-end justify-between gap-2">
                    {data.dailyActivity.map((day, index) => (
                      <div key={index} className="flex flex-col items-center flex-1">
                        <div className="w-full bg-blue-600 rounded-t" style={{ height: `${(day.total / Math.max(...data.dailyActivity.map(d => d.total))) * 200}px` }}></div>
                        <p className="text-xs text-gray-600 mt-2">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        <p className="text-xs font-medium text-gray-900">{day.total}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Sync Reports Tab */}
            {activeTab === 'sync-reports' && data && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Sync Reports</h2>
                  <button
                    onClick={() => handleExportReport('sync')}
                    disabled={exporting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export Sync Report
                  </button>
                </div>

                {/* Sync Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <RotateCcw className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-blue-600">Total Syncs</p>
                        <p className="text-2xl font-bold text-blue-900">{data.syncReports.totalSyncs}</p>
                        <p className="text-xs text-blue-600">All time operations</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-green-600">Successful</p>
                        <p className="text-2xl font-bold text-green-900">{data.syncReports.successfulSyncs}</p>
                        <p className="text-xs text-green-600">{data.syncReports.syncSuccessRate.toFixed(1)}% success rate</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-red-100 rounded-lg">
                        <XCircle className="h-6 w-6 text-red-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-red-600">Failed</p>
                        <p className="text-2xl font-bold text-red-900">{data.syncReports.failedSyncs}</p>
                        <p className="text-xs text-red-600">Need attention</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-yellow-100 rounded-lg">
                        <Clock className="h-6 w-6 text-yellow-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-yellow-600">Avg Time</p>
                        <p className="text-2xl font-bold text-yellow-900">{data.syncReports.averageSyncTime.toFixed(1)}s</p>
                        <p className="text-xs text-yellow-600">Per operation</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sync Timeline */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sync Operations</h3>
                  <div className="space-y-4">
                    {data.syncTimeline.map((sync) => (
                      <div key={sync.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${sync.failedCount > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                              {sync.failedCount > 0 ? (
                                <XCircle className="h-4 w-4 text-red-600" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{sync.store}</p>
                              <p className="text-sm text-gray-600">{new Date(sync.timestamp).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {sync.successCount}/{sync.productCount} products
                            </p>
                            <p className="text-xs text-gray-600">Duration: {sync.duration.toFixed(1)}s</p>
                          </div>
                        </div>
                        
                        {sync.errors.length > 0 && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                            <ul className="text-xs text-red-700 space-y-1">
                              {sync.errors.slice(0, 3).map((error, index) => (
                                <li key={index}>• {error}</li>
                              ))}
                              {sync.errors.length > 3 && (
                                <li>• ... and {sync.errors.length - 3} more errors</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Stock Movements Tab */}
            {activeTab === 'stock-movements' && data && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Stock Movements</h2>
                  <button
                    onClick={() => handleExportReport('stock-movements')}
                    disabled={exporting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export Stock Report
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.stockMovements.map((movement) => (
                        <tr key={movement.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{movement.product_name}</div>
                              <div className="text-sm text-gray-500">{movement.sku}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              movement.type === 'stock_in' 
                                ? 'bg-green-100 text-green-800'
                                : movement.type === 'stock_out'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {movement.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {movement.type === 'stock_in' ? (
                                <ArrowUpRight className="h-4 w-4 text-green-600 mr-1" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4 text-red-600 mr-1" />
                              )}
                              <span className="text-sm font-medium text-gray-900">{movement.quantity}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {movement.user}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(movement.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {movement.notes}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Product Reports Tab */}
            {activeTab === 'product-reports' && data && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Product Reports</h2>
                  <button
                    onClick={() => handleExportReport('products')}
                    disabled={exporting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export Product Report
                  </button>
                </div>

                {/* Most Selling Products */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Most Selling Products
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Product
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Units Sold
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Sale
                          </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.mostSelling.map((product, index) => (
                          <tr key={product.sku}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-800 text-xs font-bold rounded-full flex items-center justify-center mr-3">
                                  {index + 1}
                                </span>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                                  <div className="text-sm text-gray-500">{product.sku}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {product.category}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-green-600">{product.totalSold}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(product.lastSaleDate).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Least Selling Products */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    Least Selling Products
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Product
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Units Sold
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Days Since Last Sale
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.leastSelling.map((product, index) => (
                          <tr key={product.sku}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-800 text-xs font-bold rounded-full flex items-center justify-center mr-3">
                                  {index + 1}
                                </span>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                                  <div className="text-sm text-gray-500">{product.sku}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {product.category}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-red-600">{product.totalSold}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {product.daysSinceLastSale} days
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
            {activeTab === 'user-activity' && data && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">User Activity</h2>
                  <button
                    onClick={() => handleExportReport('user-activity')}
                    disabled={exporting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export User Report
                  </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Activities
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sync Activities
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stock Activities
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Activity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.userActivity.map((user) => (
                        <tr key={user.user}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8">
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                  <Users className="h-4 w-4 text-blue-600" />
                                </div>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">{user.user}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.activities}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                            {user.syncActivities}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {user.stockActivities}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.lastActivity).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && data && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Analytics Dashboard</h2>
                
                {/* Performance Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100">Sync Success Rate</p>
                        <p className="text-3xl font-bold">{data.syncReports.syncSuccessRate.toFixed(1)}%</p>
                      </div>
                      <Zap className="h-8 w-8 text-blue-200" />
                  </div>
                </div>

                  <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100">Total Operations</p>
                        <p className="text-3xl font-bold">{data.overview.transactions.toLocaleString()}</p>
                    </div>
                      <Activity className="h-8 w-8 text-green-200" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100">Active Users</p>
                        <p className="text-3xl font-bold">{data.overview.activeUsers}</p>
              </div>
                      <Users className="h-8 w-8 text-purple-200" />
                    </div>
                  </div>
                </div>

                {/* Additional Analytics Charts and Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Distribution</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Sync Operations</span>
                        <span className="text-sm font-medium text-blue-600">{data.syncReports.totalSyncs}</span>
                        </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Stock Movements</span>
                        <span className="text-sm font-medium text-green-600">{data.overview.transactions}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Scan Activities</span>
                        <span className="text-sm font-medium text-purple-600">{data.overview.recentScans}</span>
                      </div>
                    </div>
                                </div>

                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">System Status</span>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Healthy
                        </span>
                              </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Last Backup</span>
                        <span className="text-sm font-medium text-gray-900">
                          {new Date().toLocaleDateString()}
                        </span>
                                    </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Database Status</span>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Connected
                                    </span>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>
    </Layout>
    </ProtectedRoute>
  )
}