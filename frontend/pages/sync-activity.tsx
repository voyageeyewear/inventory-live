import { useState, useEffect, useCallback } from 'react'
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
  QrCode,
  ExternalLink,
  Plus,
  Minus,
  Target,
  Globe,
  Server,
  Wifi,
  WifiOff,
  CheckSquare,
  Square,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface SyncActivity {
  id: number
  type: 'product_sync' | 'stock_movement' | 'barcode_scan' | 'store_sync' | 'mobile_activity' | 'system_event'
  action: string
  status: 'success' | 'failed' | 'pending' | 'warning' | 'info'
  entity_type: 'product' | 'store' | 'user' | 'system'
  entity_id: string
  entity_name: string
  sku?: string
  product_name?: string
  store_name?: string
  user_name?: string
  quantity?: number
  old_quantity?: number
  new_quantity?: number
  notes?: string
  error_message?: string
  duration_ms?: number
  created_at: string
  updated_at?: string
  // Consolidation fields
  duplicate_count?: number
  consolidated_quantities?: number[]
  total_quantity_change?: number
  duplicate_activities?: number[]
}

interface ActivityStats {
  total_activities: number
  today_activities: number
  successful_syncs: number
  failed_syncs: number
  pending_syncs: number
  total_products_synced: number
  total_stock_movements: number
  total_barcode_scans: number
  total_mobile_activities: number
  average_sync_time: number
  last_sync_time: string
  sync_success_rate: number
  most_active_user: string
  most_synced_product: string
  hourly_activity: { hour: number, count: number }[]
  daily_activity: { date: string, count: number }[]
  activity_by_type: { type: string, count: number }[]
  activity_by_status: { status: string, count: number }[]
  // Consolidation stats
  total_duplicates_consolidated: number
  total_quantity_changes: number
  average_duplicates_per_sku: number
}

interface Filters {
  type: string
  status: string
  entity_type: string
  search: string
  start_date: string
  end_date: string
  user: string
  store: string
  page: number
  limit: number
  sort_by: string
  sort_order: 'asc' | 'desc'
}

export default function SyncActivity() {
  const { user, isFullyAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activities, setActivities] = useState<SyncActivity[]>([])
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [pagination, setPagination] = useState({ 
    page: 1, 
    pages: 1, 
    total: 0, 
    limit: 25,
    hasNext: false,
    hasPrev: false
  })
  const [activeTab, setActiveTab] = useState<'dashboard' | 'activities' | 'analytics' | 'real-time'>('dashboard')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedActivities, setSelectedActivities] = useState<Set<number>>(new Set())
  const [filters, setFilters] = useState<Filters>({
    type: '',
    status: '',
    entity_type: '',
    search: '',
    start_date: '',
    end_date: '',
    user: '',
    store: '',
    page: 1,
    limit: 25,
    sort_by: 'created_at',
    sort_order: 'desc'
  })
  const [realTimeEnabled, setRealTimeEnabled] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Fetch activities and stats
  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    else setRefreshing(true)

    try {
      const [activitiesResponse, statsResponse] = await Promise.all([
        axios.get('/api/sync-activity/activities', { 
          params: {
            ...filters,
            page: filters.page,
            limit: filters.limit
          }
        }),
        axios.get('/api/sync-activity/stats')
      ])

      if (activitiesResponse.data.success) {
        setActivities(activitiesResponse.data.activities || [])
        setPagination(activitiesResponse.data.pagination || {
          page: 1, pages: 1, total: 0, limit: 25, hasNext: false, hasPrev: false
        })
      }

      if (statsResponse.data.success) {
        setStats(statsResponse.data.stats)
      }

      setLastUpdate(new Date())
    } catch (error: any) {
      console.error('Error fetching sync activity data:', error)
      toast.error('Failed to fetch sync activity data: ' + (error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filters])

  // Initial data fetch
  useEffect(() => {
    if (isFullyAuthenticated) {
      fetchData()
    }
  }, [isFullyAuthenticated, fetchData])

  // Real-time updates
  useEffect(() => {
    if (!realTimeEnabled || !isFullyAuthenticated) return

    const interval = setInterval(() => {
      fetchData(false)
    }, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [realTimeEnabled, isFullyAuthenticated, fetchData])

  // Filter change handler
  const handleFilterChange = (key: keyof Filters, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value as number
    }))
  }

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      type: '',
      status: '',
      entity_type: '',
      search: '',
      start_date: '',
      end_date: '',
      user: '',
      store: '',
      page: 1,
      limit: 25,
      sort_by: 'created_at',
      sort_order: 'desc'
    })
  }

  // Activity selection handlers
  const handleSelectActivity = (id: number) => {
    const newSelected = new Set(selectedActivities)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedActivities(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedActivities.size === activities.length) {
      setSelectedActivities(new Set())
    } else {
      setSelectedActivities(new Set(activities.map(a => a.id)))
    }
  }

  // Export activities
  const exportActivities = async () => {
    try {
      const response = await axios.get('/api/sync-activity/export', {
        params: filters,
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `sync-activities-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Activities exported successfully')
    } catch (error: any) {
      toast.error('Failed to export activities: ' + (error.response?.data?.message || error.message))
    }
  }

  // Get activity icon
  const getActivityIcon = (type: string, status: string) => {
    const iconClass = "h-5 w-5"
    const statusColor = status === 'success' ? 'text-green-600' : 
                      status === 'failed' ? 'text-red-600' :
                      status === 'warning' ? 'text-yellow-600' :
                      status === 'pending' ? 'text-blue-600' : 'text-gray-600'
    
    switch (type) {
      case 'product_sync':
        return <Package className={`${iconClass} ${statusColor}`} />
      case 'stock_movement':
        return <ArrowUpDown className={`${iconClass} ${statusColor}`} />
      case 'barcode_scan':
        return <QrCode className={`${iconClass} ${statusColor}`} />
      case 'store_sync':
        return <Store className={`${iconClass} ${statusColor}`} />
      case 'mobile_activity':
        return <Smartphone className={`${iconClass} ${statusColor}`} />
      case 'system_event':
        return <Server className={`${iconClass} ${statusColor}`} />
      default:
        return <Activity className={`${iconClass} ${statusColor}`} />
    }
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
    
    switch (status) {
      case 'success':
        return (
          <span className={`${baseClasses} bg-green-100 text-green-800 border border-green-200`}>
            <CheckCircle className="h-3 w-3" />
            Success
          </span>
        )
      case 'failed':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-800 border border-red-200`}>
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        )
      case 'pending':
        return (
          <span className={`${baseClasses} bg-blue-100 text-blue-800 border border-blue-200`}>
            <Clock className="h-3 w-3" />
            Pending
          </span>
        )
      case 'warning':
        return (
          <span className={`${baseClasses} bg-yellow-100 text-yellow-800 border border-yellow-200`}>
            <AlertTriangle className="h-3 w-3" />
            Warning
          </span>
        )
      default:
    return (
          <span className={`${baseClasses} bg-gray-100 text-gray-800 border border-gray-200`}>
            <Info className="h-3 w-3" />
            Info
          </span>
        )
    }
  }

  // Format date
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

  // Format number
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  // Loading state
  if (loading) {
    return (
      <ProtectedRoute requiredPermission="viewProducts">
      <Layout>
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
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
                <Activity className="h-8 w-8 text-blue-600" />
                Sync Activity Monitor
              </h1>
              <p className="text-gray-600 mt-1">
                Real-time monitoring and comprehensive history of all system synchronization activities
              </p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  Last updated: {formatDate(lastUpdate.toISOString())}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${realTimeEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm text-gray-600">
                    {realTimeEnabled ? 'Real-time updates enabled' : 'Real-time updates disabled'}
                  </span>
                </div>
              </div>
          </div>
            
          <div className="flex items-center gap-3">
              <button
                onClick={() => setRealTimeEnabled(!realTimeEnabled)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  realTimeEnabled 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {realTimeEnabled ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {realTimeEnabled ? 'Live' : 'Static'}
              </button>
            <button 
              onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button 
                onClick={exportActivities}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                onClick={() => fetchData(false)}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
                { id: 'activities', name: 'Activity Log', icon: History },
                { id: 'analytics', name: 'Analytics', icon: TrendingUp },
                { id: 'real-time', name: 'Real-time Monitor', icon: Zap }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
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

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && stats && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <Activity className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Activities</p>
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_activities)}</p>
                      <p className="text-xs text-gray-500 mt-1">All time</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <Calendar className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Today's Activities</p>
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.today_activities)}</p>
                      <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-emerald-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Success Rate</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.sync_success_rate.toFixed(1)}%</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatNumber(stats.successful_syncs)} / {formatNumber(stats.successful_syncs + stats.failed_syncs)} syncs
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Avg Sync Time</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.average_sync_time}ms</p>
                      <p className="text-xs text-gray-500 mt-1">Per operation</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Activity by Type */}
                <div className="bg-white rounded-lg shadow border">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Activity by Type</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {stats.activity_by_type.map((item) => (
                      <div key={item.type} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getActivityIcon(item.type, 'success')}
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {item.type.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">{formatNumber(item.count)}</span>
                          <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${(item.count / stats.total_activities) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity by Status */}
                <div className="bg-white rounded-lg shadow border">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Activity by Status</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {stats.activity_by_status.map((item) => (
                      <div key={item.status} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusBadge(item.status)}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">{formatNumber(item.count)}</span>
                          <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className={`h-2 rounded-full ${
                                item.status === 'success' ? 'bg-green-600' :
                                item.status === 'failed' ? 'bg-red-600' :
                                item.status === 'warning' ? 'bg-yellow-600' :
                                item.status === 'pending' ? 'bg-blue-600' : 'bg-gray-600'
                              }`}
                              style={{ width: `${(item.count / stats.total_activities) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-lg shadow border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Quick Statistics</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="text-center">
                      <Package className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_products_synced)}</p>
                      <p className="text-sm text-gray-600">Products Synced</p>
                    </div>
                    <div className="text-center">
                      <ArrowUpDown className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_stock_movements)}</p>
                      <p className="text-sm text-gray-600">Stock Movements</p>
                    </div>
                    <div className="text-center">
                      <QrCode className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_barcode_scans)}</p>
                      <p className="text-sm text-gray-600">Barcode Scans</p>
                    </div>
                    <div className="text-center">
                      <Smartphone className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_mobile_activities)}</p>
                      <p className="text-sm text-gray-600">Mobile Activities</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Consolidation Statistics */}
              <div className="bg-white rounded-lg shadow border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <Package className="h-5 w-5 text-yellow-600" />
                    Duplicate Consolidation
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <Package className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-yellow-800">{formatNumber(stats.total_duplicates_consolidated)}</p>
                        <p className="text-sm text-yellow-600">Duplicates Consolidated</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-blue-800">{formatNumber(stats.total_quantity_changes)}</p>
                        <p className="text-sm text-blue-600">Total Quantity Changes</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <BarChart3 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-green-800">{stats.average_duplicates_per_sku?.toFixed(1) || '0.0'}</p>
                        <p className="text-sm text-green-600">Avg Duplicates per SKU</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <Info className="h-4 w-4" />
                      <span className="text-sm font-medium">Consolidation Summary</span>
                    </div>
                    <p className="text-sm text-yellow-700 mt-1">
                      The system automatically consolidates duplicate SKU entries to show total quantity changes. 
                      This reduces clutter and provides clearer insights into actual inventory movements.
                    </p>
                  </div>
                </div>
              </div>

              {/* System Info */}
              <div className="bg-white rounded-lg shadow border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">System Information</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Last Sync</p>
                      <p className="text-lg font-semibold text-gray-900">{formatDate(stats.last_sync_time)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Most Active User</p>
                      <p className="text-lg font-semibold text-gray-900">{stats.most_active_user || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Most Synced Product</p>
                      <p className="text-lg font-semibold text-gray-900">{stats.most_synced_product || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Activities Tab */}
          {activeTab === 'activities' && (
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                          <option value="">All Types</option>
                          <option value="product_sync">Product Sync</option>
                          <option value="stock_movement">Stock Movement</option>
                          <option value="barcode_scan">Barcode Scan</option>
                          <option value="store_sync">Store Sync</option>
                          <option value="mobile_activity">Mobile Activity</option>
                          <option value="system_event">System Event</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                          value={filters.status}
                          onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                          value={filters.end_date}
                          onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search activities..."
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                        <select
                          value={filters.sort_by}
                          onChange={(e) => handleFilterChange('sort_by', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="created_at">Date</option>
                          <option value="type">Type</option>
                          <option value="status">Status</option>
                          <option value="entity_name">Entity Name</option>
                          <option value="user_name">User</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                        <select
                          value={filters.sort_order}
                          onChange={(e) => handleFilterChange('sort_order', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="desc">Newest First</option>
                          <option value="asc">Oldest First</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Per Page</label>
                        <select
                          value={filters.limit}
                          onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
              <button
                onClick={clearFilters}
                          className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Clear Filters
              </button>
              <span className="text-sm text-gray-500">
                          {formatNumber(pagination.total)} total activities
              </span>
                      </div>
                      
                      {selectedActivities.size > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">
                            {selectedActivities.size} selected
                          </span>
                          <button
                            onClick={() => setSelectedActivities(new Set())}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Clear selection
                          </button>
                        </div>
                      )}
                    </div>
            </div>
          </div>
        )}

              {/* Activity List */}
              <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Activity Log</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-700"
                      >
                        {selectedActivities.size === activities.length ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        Select All
                      </button>
              </div>
            </div>
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
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedActivities.has(activity.id)}
                              onChange={() => handleSelectActivity(activity.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-shrink-0">
                              {getActivityIcon(activity.type, activity.status)}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <h4 className="text-sm font-medium text-gray-900">{activity.action}</h4>
                                {getStatusBadge(activity.status)}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">{formatDate(activity.created_at)}</span>
                                <button className="text-gray-400 hover:text-gray-600">
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="mt-1">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">{activity.entity_name}</span>
                                {activity.sku && (
                                  <span className="ml-2 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                    {activity.sku}
                                  </span>
                                )}
                              </p>
                            </div>
                            
                            {activity.quantity !== undefined && (
                              <div className="mt-2 flex items-center gap-4">
                                {activity.old_quantity !== undefined && activity.new_quantity !== undefined && (
                                  <span className="text-sm text-gray-600">
                                    Quantity: {activity.old_quantity} → {activity.new_quantity}
                                    <span className={`ml-2 font-medium ${
                                      activity.new_quantity > activity.old_quantity ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      ({activity.new_quantity > activity.old_quantity ? '+' : ''}{activity.new_quantity - activity.old_quantity})
                                    </span>
                                  </span>
                                )}
                                
                                {/* Show total quantity change for consolidated activities */}
                                {activity.total_quantity_change !== undefined && (activity.duplicate_count || 0) > 1 && (
                                  <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                    Total Change: {activity.total_quantity_change > 0 ? '+' : ''}{activity.total_quantity_change}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* Show duplicate consolidation info */}
                            {(activity.duplicate_count || 0) > 1 && (
                              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                <div className="flex items-center gap-2 text-yellow-800">
                                  <Package className="h-4 w-4" />
                                  <span className="font-medium">Consolidated Duplicates:</span>
                                  <span>{activity.duplicate_count || 0} entries</span>
                                </div>
                                <div className="mt-1 text-yellow-700">
                                  Individual quantities: {activity.consolidated_quantities?.join(' + ') || 'N/A'} = {activity.total_quantity_change}
                                </div>
                              </div>
                            )}
                            
                            {activity.error_message && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                <AlertTriangle className="h-4 w-4 inline mr-1" />
                                {activity.error_message}
                              </div>
                            )}
                            
                            {activity.notes && (
                              <div className="mt-2 text-sm text-gray-600">
                                <FileText className="h-4 w-4 inline mr-1" />
                                {activity.notes}
                              </div>
                            )}
                            
                            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                              <span>By {activity.user_name || 'System'}</span>
                              <span>•</span>
                              <span className="capitalize">{activity.entity_type}</span>
                              {activity.duration_ms && (
                                <>
                                  <span>•</span>
                                  <span>{activity.duration_ms}ms</span>
                                </>
                              )}
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
                        {formatNumber(pagination.total)} results
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                          onClick={() => handleFilterChange('page', pagination.page - 1)}
                          disabled={!pagination.hasPrev}
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
                          disabled={!pagination.hasNext}
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

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
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

          {/* Real-time Monitor Tab */}
          {activeTab === 'real-time' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow border">
                <div className="p-12 text-center">
                  <Zap className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">Real-time Activity Monitor</h3>
                  <p className="text-gray-600 mb-6">
                    Live monitoring of sync activities is coming soon. This will include:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Wifi className="h-4 w-4 text-blue-500" />
                      <span>Live activity feed</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Target className="h-4 w-4 text-green-500" />
                      <span>Real-time notifications</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Globe className="h-4 w-4 text-orange-500" />
                      <span>System health monitoring</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Server className="h-4 w-4 text-purple-500" />
                      <span>Performance dashboards</span>
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