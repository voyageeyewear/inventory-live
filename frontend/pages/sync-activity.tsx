import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { 
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Calendar,
  Package,
  Search,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Zap,
  Database,
  Smartphone,
  Store,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Settings,
  Info,
  ArrowUpDown,
  FileText,
  History,
  RefreshCcw,
  Upload,
  ShoppingCart,
  QrCode
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface ActivityLog {
  id: string
  type: 'product_sync' | 'stock_movement' | 'barcode_scan' | 'user_action' | 'system_event' | 'store_sync' | 'mobile_transaction'
  action: string
  status: 'success' | 'failed' | 'pending' | 'warning' | 'info'
  entity_type: 'product' | 'store' | 'user' | 'system' | 'scan' | 'transaction'
  entity_id: string
  entity_name: string
  details: {
    sku?: string
    product_name?: string
    store_name?: string
    user_name?: string
    old_value?: any
    new_value?: any
    quantity_change?: number
    error_message?: string
    duration_ms?: number
    metadata?: any
  }
  created_at: string
  created_by?: string
}

interface ActivityStats {
  total: number
  today: number
  last7Days: number
  last30Days: number
  byType: { [key: string]: number }
  byStatus: { [key: string]: number }
  recentTrends: {
    productSync: number
    stockMovements: number
    barcodeScans: number
    userActions: number
  }
}

interface ActivityFilters {
  type: string
  status: string
  entity_type: string
  search: string
  start_date: string
  end_date: string
  user: string
  page: number
  limit: number
}

export default function SyncActivity() {
  const { user, isFullyAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 50 })
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'analytics'>('overview')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<ActivityFilters>({
    type: '',
    status: '',
    entity_type: '',
    search: '',
    start_date: '',
    end_date: '',
    user: '',
    page: 1,
    limit: 50
  })

  useEffect(() => {
    if (isFullyAuthenticated) {
      fetchData()
    }
  }, [isFullyAuthenticated, filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch activity data from multiple sources
      const results = await Promise.allSettled([
        fetchStockLogs(),
        fetchScanLogs(),
        fetchProductActivity(),
        fetchStoreActivity()
      ])

      // Combine all activities
      const allActivities: ActivityLog[] = []
      let totalStats = {
        total: 0,
        today: 0,
        last7Days: 0,
        last30Days: 0,
        byType: {} as { [key: string]: number },
        byStatus: {} as { [key: string]: number },
        recentTrends: {
          productSync: 0,
          stockMovements: 0,
          barcodeScans: 0,
          userActions: 0
        }
      }

      // Process each result
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          allActivities.push(...result.value.activities)
        }
      })

      // Sort activities by date (most recent first)
      allActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // Apply pagination
      const startIndex = (filters.page - 1) * filters.limit
      const endIndex = startIndex + filters.limit
      const paginatedActivities = allActivities.slice(startIndex, endIndex)

      // Calculate stats
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      allActivities.forEach(activity => {
        const activityDate = new Date(activity.created_at)
        
        // Count by type
        totalStats.byType[activity.type] = (totalStats.byType[activity.type] || 0) + 1
        
        // Count by status
        totalStats.byStatus[activity.status] = (totalStats.byStatus[activity.status] || 0) + 1
        
        // Count trends
        if (activityDate >= today) totalStats.today++
        if (activityDate >= sevenDaysAgo) totalStats.last7Days++
        if (activityDate >= thirtyDaysAgo) totalStats.last30Days++
        
        // Specific trend counts
        if (activity.type === 'product_sync') totalStats.recentTrends.productSync++
        if (activity.type === 'stock_movement') totalStats.recentTrends.stockMovements++
        if (activity.type === 'barcode_scan') totalStats.recentTrends.barcodeScans++
        if (activity.type === 'user_action') totalStats.recentTrends.userActions++
      })

      totalStats.total = allActivities.length

      setActivities(paginatedActivities)
      setStats(totalStats)
      setPagination({
        page: filters.page,
        pages: Math.ceil(allActivities.length / filters.limit),
        total: allActivities.length,
        limit: filters.limit
      })

    } catch (error: any) {
      console.error('Sync activity fetch error:', error)
      toast.error('Failed to fetch activity data')
    } finally {
      setLoading(false)
    }
  }

  const fetchStockLogs = async () => {
    try {
      const response = await axios.get('/api/stock-logs?limit=1000')
      const stockLogs = response.data.stockLogs || response.data || []
      
      const activities: ActivityLog[] = stockLogs.map((log: any) => ({
        id: `stock_${log.id}`,
        type: 'stock_movement' as const,
        action: log.type === 'stock_in' ? 'Stock Added' : 'Stock Removed',
        status: 'success' as const,
        entity_type: 'product' as const,
        entity_id: log.product_id || log.sku,
        entity_name: log.product_name || log.sku,
        details: {
          sku: log.sku,
          product_name: log.product_name,
          user_name: log.user_name,
          old_value: log.previous_quantity,
          new_value: log.new_quantity,
          quantity_change: log.quantity,
          metadata: {
            notes: log.notes,
            type: log.type
          }
        },
        created_at: log.created_at,
        created_by: log.user_name
      }))

      return { activities }
    } catch (error) {
      console.error('Failed to fetch stock logs:', error)
      return { activities: [] }
    }
  }

  const fetchScanLogs = async () => {
    try {
      const response = await axios.get('/api/scan-logs?limit=1000')
      const scanLogs = response.data || []
      
      const activities: ActivityLog[] = scanLogs.map((log: any) => ({
        id: `scan_${log.id}`,
        type: 'barcode_scan' as const,
        action: 'Barcode Scanned',
        status: 'success' as const,
        entity_type: 'scan' as const,
        entity_id: log.sku,
        entity_name: log.sku,
        details: {
          sku: log.sku,
          user_name: log.user_name || 'Mobile User',
          metadata: {
            session_id: log.session_id,
            quantity: log.quantity
          }
        },
        created_at: log.created_at,
        created_by: log.user_name || 'Mobile User'
      }))

      return { activities }
    } catch (error) {
      console.error('Failed to fetch scan logs:', error)
      return { activities: [] }
    }
  }

  const fetchProductActivity = async () => {
    try {
      const response = await axios.get('/api/products')
      const products = response.data || []
      
      // Create synthetic product sync activities based on product updates
      const activities: ActivityLog[] = products
        .filter((product: any) => product.updated_at !== product.created_at)
        .map((product: any) => ({
          id: `product_${product.id}`,
          type: 'product_sync' as const,
          action: 'Product Updated',
          status: 'success' as const,
          entity_type: 'product' as const,
          entity_id: product.id,
          entity_name: product.product_name,
          details: {
            sku: product.sku,
            product_name: product.product_name,
            metadata: {
              category: product.category,
              quantity: product.quantity,
              price: product.price,
              is_active: product.is_active
            }
          },
          created_at: product.updated_at,
          created_by: 'System'
        }))

      return { activities }
    } catch (error) {
      console.error('Failed to fetch product activity:', error)
      return { activities: [] }
    }
  }

  const fetchStoreActivity = async () => {
    try {
      const response = await axios.get('/api/stores')
      const stores = response.data || []
      
      // Create synthetic store sync activities
      const activities: ActivityLog[] = stores.map((store: any) => ({
        id: `store_${store.id}`,
        type: 'store_sync' as const,
        action: store.connected ? 'Store Connected' : 'Store Disconnected',
        status: store.connected ? 'success' as const : 'warning' as const,
        entity_type: 'store' as const,
        entity_id: store.id,
        entity_name: store.store_name,
        details: {
          store_name: store.store_name,
          metadata: {
            store_domain: store.store_domain,
            connected: store.connected,
            last_sync: store.last_sync
          }
        },
        created_at: store.updated_at || store.created_at,
        created_by: 'System'
      }))

      return { activities }
    } catch (error) {
      console.error('Failed to fetch store activity:', error)
      return { activities: [] }
    }
  }

  const handleFilterChange = (key: keyof ActivityFilters, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : (typeof value === 'number' ? value : 1) // Reset to first page when filtering
    }))
  }

  const clearFilters = () => {
    setFilters({
      type: '',
      status: '',
      entity_type: '',
      search: '',
      start_date: '',
      end_date: '',
      user: '',
      page: 1,
      limit: 50
    })
  }

  const getActivityIcon = (type: string, status: string) => {
    const iconClass = "h-4 w-4"
    
    switch (type) {
      case 'product_sync':
        return <Package className={`${iconClass} ${status === 'success' ? 'text-blue-600' : 'text-red-600'}`} />
      case 'stock_movement':
        return <ArrowUpDown className={`${iconClass} ${status === 'success' ? 'text-green-600' : 'text-red-600'}`} />
      case 'barcode_scan':
        return <QrCode className={`${iconClass} ${status === 'success' ? 'text-purple-600' : 'text-red-600'}`} />
      case 'store_sync':
        return <Store className={`${iconClass} ${status === 'success' ? 'text-indigo-600' : 'text-yellow-600'}`} />
      case 'user_action':
        return <Users className={`${iconClass} ${status === 'success' ? 'text-teal-600' : 'text-red-600'}`} />
      case 'mobile_transaction':
        return <Smartphone className={`${iconClass} ${status === 'success' ? 'text-orange-600' : 'text-red-600'}`} />
      default:
        return <Activity className={`${iconClass} text-gray-600`} />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      default:
        return <Info className="h-4 w-4 text-blue-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'failed':
        return 'text-red-700 bg-red-50 border-red-200'
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      case 'warning':
        return 'text-orange-700 bg-orange-50 border-orange-200'
      default:
        return 'text-blue-700 bg-blue-50 border-blue-200'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  if (loading) {
    return (
      <ProtectedRoute requiredPermission="viewProducts">
        <Layout>
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
            <span className="ml-2 text-gray-600">Loading sync activity...</span>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredPermission="viewProducts">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <RefreshCcw className="h-8 w-8 text-purple-600" />
                Sync Activity
              </h1>
              <p className="text-gray-600 mt-1">Complete history of all system activities and synchronization events</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', name: 'Overview', icon: BarChart3 },
                { id: 'activity', name: 'Activity Log', icon: History },
                { id: 'analytics', name: 'Analytics', icon: TrendingUp }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              {/* Activity Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <Activity className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Activities</p>
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <Calendar className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Today</p>
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.today)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Last 7 Days</p>
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.last7Days)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <BarChart3 className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Last 30 Days</p>
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.last30Days)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Type */}
                <div className="bg-white rounded-lg shadow border">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Activity by Type</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {Object.entries(stats.byType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getActivityIcon(type, 'success')}
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {type.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{formatNumber(count)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* By Status */}
                <div className="bg-white rounded-lg shadow border">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Activity by Status</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {Object.entries(stats.byStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(status)}
                          <span className="text-sm font-medium text-gray-900 capitalize">{status}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{formatNumber(count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Trends */}
              <div className="bg-white rounded-lg shadow border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Recent Activity Trends</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <Package className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.recentTrends.productSync)}</p>
                      <p className="text-sm text-gray-600">Product Syncs</p>
                    </div>
                    <div className="text-center">
                      <ArrowUpDown className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.recentTrends.stockMovements)}</p>
                      <p className="text-sm text-gray-600">Stock Movements</p>
                    </div>
                    <div className="text-center">
                      <QrCode className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.recentTrends.barcodeScans)}</p>
                      <p className="text-sm text-gray-600">Barcode Scans</p>
                    </div>
                    <div className="text-center">
                      <Users className="h-8 w-8 text-teal-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.recentTrends.userActions)}</p>
                      <p className="text-sm text-gray-600">User Actions</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-6">
              {/* Filters */}
              {showFilters && (
                <div className="bg-white rounded-lg shadow border">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Filter Activities</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                          value={filters.type}
                          onChange={(e) => handleFilterChange('type', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">All Types</option>
                          <option value="product_sync">Product Sync</option>
                          <option value="stock_movement">Stock Movement</option>
                          <option value="barcode_scan">Barcode Scan</option>
                          <option value="store_sync">Store Sync</option>
                          <option value="user_action">User Action</option>
                          <option value="mobile_transaction">Mobile Transaction</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                          value={filters.status}
                          onChange={(e) => handleFilterChange('status', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">All Status</option>
                          <option value="success">Success</option>
                          <option value="failed">Failed</option>
                          <option value="pending">Pending</option>
                          <option value="warning">Warning</option>
                          <option value="info">Info</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={filters.start_date}
                          onChange={(e) => handleFilterChange('start_date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input
                          type="date"
                          value={filters.end_date}
                          onChange={(e) => handleFilterChange('end_date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={clearFilters}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Clear Filters
                      </button>
                      <span className="text-sm text-gray-500">
                        {pagination.total} total activities
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity List */}
              <div className="bg-white rounded-lg shadow border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Activity Log</h3>
                </div>
                
                {activities.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-gray-500">No activities found</p>
                    <p className="text-sm text-gray-400">Try adjusting your filters or check back later</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {activities.map((activity) => (
                      <div key={activity.id} className="p-6 hover:bg-gray-50">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            {getActivityIcon(activity.type, activity.status)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-medium text-gray-900">{activity.action}</h4>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(activity.status)}`}>
                                  {getStatusIcon(activity.status)}
                                  {activity.status}
                                </span>
                              </div>
                              <span className="text-sm text-gray-500">{formatDate(activity.created_at)}</span>
                            </div>
                            
                            <div className="mt-1">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">{activity.entity_name}</span>
                                {activity.details.sku && (
                                  <span className="ml-2 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                    {activity.details.sku}
                                  </span>
                                )}
                              </p>
                            </div>
                            
                            {activity.details.quantity_change && (
                              <div className="mt-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  activity.details.quantity_change > 0 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {activity.details.quantity_change > 0 ? '+' : ''}{activity.details.quantity_change} units
                                </span>
                              </div>
                            )}
                            
                            {activity.details.error_message && (
                              <div className="mt-2 text-sm text-red-600">
                                {activity.details.error_message}
                              </div>
                            )}
                            
                            <div className="mt-2 text-xs text-gray-500">
                              By {activity.created_by || 'System'} • {activity.entity_type}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                        {pagination.total} results
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFilterChange('page', pagination.page - 1)}
                          disabled={pagination.page === 1}
                          className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </button>
                        <span className="text-sm text-gray-700">
                          Page {pagination.page} of {pagination.pages}
                        </span>
                        <button
                          onClick={() => handleFilterChange('page', pagination.page + 1)}
                          disabled={pagination.page === pagination.pages}
                          className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Coming Soon */}
              <div className="bg-white rounded-lg shadow border">
                <div className="p-12 text-center">
                  <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">Advanced Analytics</h3>
                  <p className="text-gray-600 mb-6">
                    Detailed analytics and insights for sync activities are coming soon. This will include:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
                    <div className="flex items-center gap-2 text-gray-600">
                      <BarChart3 className="h-4 w-4 text-blue-500" />
                      <span>Activity trend charts</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4 text-green-500" />
                      <span>Performance metrics</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span>Error analysis</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Database className="h-4 w-4 text-purple-500" />
                      <span>Sync efficiency reports</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
