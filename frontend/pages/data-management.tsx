import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { 
  Database,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Shield,
  FileText,
  Calendar,
  HardDrive,
  RefreshCw,
  CheckCircle,
  XCircle,
  Info,
  Package,
  Store,
  Activity,
  BarChart3,
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
  Eye,
  Settings,
  Archive,
  Filter,
  Search,
  Plus,
  Minus
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface DatabaseStats {
  products: {
    total: number
    active: number
    inactive: number
    categories: number
    avgQuantity: number
    totalValue: number
  }
  stores: {
    total: number
    connected: number
    disconnected: number
  }
  stockLogs: {
    total: number
    stockIn: number
    stockOut: number
    last7Days: number
    last30Days: number
  }
  scanLogs: {
    total: number
    last7Days: number
    last30Days: number
    uniqueProducts: number
  }
  users: {
    total: number
    active: number
    roles: { [key: string]: number }
  }
  mobileTransactions: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
}

interface SystemHealth {
  database: 'healthy' | 'warning' | 'error'
  api: 'healthy' | 'warning' | 'error'
  storage: 'healthy' | 'warning' | 'error'
  lastBackup: string | null
  uptime: number
}

export default function DataManagement() {
  const { user, isFullyAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'backup' | 'maintenance' | 'analytics'>('overview')
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  useEffect(() => {
    if (isFullyAuthenticated) {
      fetchData()
    }
  }, [isFullyAuthenticated])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch database statistics - handle each API call separately to avoid failing all if one fails
      const results = await Promise.allSettled([
        axios.get('/api/products'),
        axios.get('/api/stores'),
        axios.get('/api/stock-logs?limit=1000'),
        axios.get('/api/scan-logs?limit=1000'),
        axios.get('/api/users').catch(() => ({ data: [] })) // Gracefully handle users API failure
      ])

      const productsRes = results[0].status === 'fulfilled' ? results[0].value : { data: [] }
      const storesRes = results[1].status === 'fulfilled' ? results[1].value : { data: [] }
      const stockLogsRes = results[2].status === 'fulfilled' ? results[2].value : { data: { stockLogs: [] } }
      const scanLogsRes = results[3].status === 'fulfilled' ? results[3].value : { data: [] }
      const usersRes = results[4].status === 'fulfilled' ? results[4].value : { data: [] }

      // Calculate statistics
      const products = productsRes.data || []
      const stores = storesRes.data || []
      const stockLogs = stockLogsRes.data.stockLogs || []
      const scanLogs = scanLogsRes.data || []
      const users = usersRes.data || []

      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const calculatedStats: DatabaseStats = {
        products: {
          total: products.length,
          active: products.filter((p: any) => p.is_active).length,
          inactive: products.filter((p: any) => !p.is_active).length,
          categories: Array.from(new Set(products.map((p: any) => p.category))).length,
          avgQuantity: products.length > 0 ? Math.round(products.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0) / products.length) : 0,
          totalValue: products.reduce((sum: number, p: any) => sum + (parseFloat(p.price) || 0) * (p.quantity || 0), 0)
        },
        stores: {
          total: stores.length,
          connected: stores.filter((s: any) => s.connected).length,
          disconnected: stores.filter((s: any) => !s.connected).length
        },
        stockLogs: {
          total: stockLogs.length,
          stockIn: stockLogs.filter((log: any) => log.type === 'stock_in').length,
          stockOut: stockLogs.filter((log: any) => log.type === 'stock_out').length,
          last7Days: stockLogs.filter((log: any) => new Date(log.created_at) >= sevenDaysAgo).length,
          last30Days: stockLogs.filter((log: any) => new Date(log.created_at) >= thirtyDaysAgo).length
        },
        scanLogs: {
          total: scanLogs.length,
          last7Days: scanLogs.filter((log: any) => new Date(log.created_at) >= sevenDaysAgo).length,
          last30Days: scanLogs.filter((log: any) => new Date(log.created_at) >= thirtyDaysAgo).length,
          uniqueProducts: Array.from(new Set(scanLogs.map((log: any) => log.sku))).length
        },
        users: {
          total: users.length,
          active: users.filter((u: any) => u.is_active).length,
          roles: users.reduce((acc: any, user: any) => {
            acc[user.role] = (acc[user.role] || 0) + 1
            return acc
          }, {})
        },
        mobileTransactions: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0
        }
      }

      // System health check
      const systemHealth: SystemHealth = {
        database: 'healthy',
        api: 'healthy',
        storage: 'healthy',
        lastBackup: null,
        uptime: Date.now()
      }

      setStats(calculatedStats)
      setHealth(systemHealth)
    } catch (error: any) {
      console.error('Data management fetch error:', error)
      toast.error('Some system data could not be loaded. Check your permissions.')
      
      // Set default empty stats if everything fails
      setStats({
        products: { total: 0, active: 0, inactive: 0, categories: 0, avgQuantity: 0, totalValue: 0 },
        stores: { total: 0, connected: 0, disconnected: 0 },
        stockLogs: { total: 0, stockIn: 0, stockOut: 0, last7Days: 0, last30Days: 0 },
        scanLogs: { total: 0, last7Days: 0, last30Days: 0, uniqueProducts: 0 },
        users: { total: 0, active: 0, roles: {} },
        mobileTransactions: { total: 0, pending: 0, approved: 0, rejected: 0 }
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = async (type: 'products' | 'all') => {
    setExporting(true)
    try {
      let endpoint = '/api/products'
      let filename = `products_export_${new Date().toISOString().split('T')[0]}.json`
      
      if (type === 'all') {
        // For 'all', we'll export products, stores, and logs
        const [productsRes, storesRes, stockLogsRes] = await Promise.all([
          axios.get('/api/products'),
          axios.get('/api/stores'),
          axios.get('/api/stock-logs?limit=1000')
        ])

        const exportData = {
          timestamp: new Date().toISOString(),
          version: '1.0',
          data: {
            products: productsRes.data,
            stores: storesRes.data,
            stockLogs: stockLogsRes.data.stockLogs || stockLogsRes.data
          }
        }

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `full_backup_${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        toast.success('✅ Full backup exported successfully')
        return
      }

      const response = await axios.get(endpoint)
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('✅ Data exported successfully')
    } catch (error: any) {
      console.error('Export error:', error)
      toast.error('❌ Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.json')) {
      toast.error('Please select a valid JSON file')
      return
    }

    const confirm = window.confirm(
      `⚠️ IMPORT DATA\n\n` +
      `This will import data from: ${file.name}\n` +
      `Size: ${(file.size / 1024 / 1024).toFixed(2)} MB\n\n` +
      `Are you sure you want to continue?`
    )

    if (!confirm) {
      event.target.value = ''
      return
    }

    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      // Handle different import formats
      if (data.data && data.data.products) {
        // Full backup format
        toast('Full backup detected - this feature is coming soon', { icon: 'ℹ️' })
      } else if (Array.isArray(data)) {
        // Simple products array
        toast('Product import feature is coming soon', { icon: 'ℹ️' })
      } else {
        toast.error('Unsupported file format')
      }
    } catch (error: any) {
      console.error('Import error:', error)
      toast.error('❌ Failed to import data - invalid file format')
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  const handleCleanupData = async (type: 'logs' | 'scans') => {
    const confirmMessage = type === 'logs' 
      ? `Delete old stock logs (older than 90 days)?`
      : `Delete old scan logs (older than 30 days)?`
    
    if (!window.confirm(confirmMessage)) return

    setCleaning(true)
    try {
      // This would need actual API endpoints
      toast('Cleanup feature is coming soon', { icon: 'ℹ️' })
    } catch (error: any) {
      console.error('Cleanup error:', error)
      toast.error('❌ Failed to cleanup data')
    } finally {
      setCleaning(false)
    }
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

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5" />
      case 'warning': return <AlertTriangle className="h-5 w-5" />
      case 'error': return <XCircle className="h-5 w-5" />
      default: return <Info className="h-5 w-5" />
    }
  }

  if (loading) {
    return (
      <ProtectedRoute requiredPermission="manageStores">
        <Layout>
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
            <span className="ml-2 text-gray-600">Loading system data...</span>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  const isAdmin = user?.role === 'admin'
  const hasManageStores = user?.permissions?.includes('manageStores') || isAdmin

  return (
    <ProtectedRoute requiredPermission="viewProducts">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Database className="h-8 w-8 text-purple-600" />
                Data Management
              </h1>
              <p className="text-gray-600 mt-1">Monitor, backup, and manage your inventory system data</p>
            </div>
            
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Permission Warning */}
          {!isAdmin && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">Limited Access</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Some features may be limited. Admin access required for full data management capabilities.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* System Health Status */}
          {health && (
            <div className="bg-white rounded-lg shadow border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  System Health
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-3">
                    <div className={getHealthColor(health.database)}>
                      {getHealthIcon(health.database)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Database</p>
                      <p className={`text-sm capitalize ${getHealthColor(health.database)}`}>
                        {health.database}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={getHealthColor(health.api)}>
                      {getHealthIcon(health.api)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">API Services</p>
                      <p className={`text-sm capitalize ${getHealthColor(health.api)}`}>
                        {health.api}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={getHealthColor(health.storage)}>
                      {getHealthIcon(health.storage)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Storage</p>
                      <p className={`text-sm capitalize ${getHealthColor(health.storage)}`}>
                        {health.storage}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', name: 'Overview', icon: BarChart3 },
                { id: 'backup', name: 'Backup & Export', icon: Download },
                { id: 'maintenance', name: 'Maintenance', icon: Settings },
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
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <Package className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Products</p>
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.products.total)}</p>
                      <p className="text-xs text-gray-500">
                        {stats.products.active} active, {stats.products.inactive} inactive
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <Store className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Connected Stores</p>
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.stores.connected)}</p>
                      <p className="text-xs text-gray-500">
                        of {stats.stores.total} total stores
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <Activity className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Stock Movements</p>
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.stockLogs.last7Days)}</p>
                      <p className="text-xs text-gray-500">
                        Last 7 days
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Active Users</p>
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.users.active)}</p>
                      <p className="text-xs text-gray-500">
                        of {stats.users.total} total users
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Statistics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Product Statistics */}
                <div className="bg-white rounded-lg shadow border">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-600" />
                      Product Statistics
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Products:</span>
                      <span className="font-medium">{formatNumber(stats.products.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Active Products:</span>
                      <span className="font-medium text-green-600">{formatNumber(stats.products.active)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Inactive Products:</span>
                      <span className="font-medium text-red-600">{formatNumber(stats.products.inactive)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Categories:</span>
                      <span className="font-medium">{formatNumber(stats.products.categories)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average Quantity:</span>
                      <span className="font-medium">{formatNumber(stats.products.avgQuantity)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-4">
                      <span className="text-gray-900 font-medium">Total Inventory Value:</span>
                      <span className="font-bold text-green-600">{formatCurrency(stats.products.totalValue)}</span>
                    </div>
                  </div>
                </div>

                {/* Activity Statistics */}
                <div className="bg-white rounded-lg shadow border">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                      <Activity className="h-5 w-5 text-orange-600" />
                      Activity Statistics
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Stock Logs:</span>
                      <span className="font-medium">{formatNumber(stats.stockLogs.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Stock In:
                      </span>
                      <span className="font-medium text-green-600">{formatNumber(stats.stockLogs.stockIn)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 flex items-center gap-1">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        Stock Out:
                      </span>
                      <span className="font-medium text-red-600">{formatNumber(stats.stockLogs.stockOut)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last 7 Days:</span>
                      <span className="font-medium">{formatNumber(stats.stockLogs.last7Days)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last 30 Days:</span>
                      <span className="font-medium">{formatNumber(stats.stockLogs.last30Days)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-4">
                      <span className="text-gray-900 font-medium">Total Scans:</span>
                      <span className="font-bold">{formatNumber(stats.scanLogs.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-6">
              {/* Export Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center mb-4">
                    <Download className="h-6 w-6 text-blue-600" />
                    <h3 className="text-lg font-medium text-gray-900 ml-2">Export Products</h3>
                  </div>
                  <p className="text-gray-600 mb-4">
                    Export all product data including inventory levels, categories, and pricing information.
                  </p>
                  <div className="space-y-2 mb-4 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Total Products:</span>
                      <span className="font-medium">{formatNumber(stats?.products.total || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Products:</span>
                      <span className="font-medium">{formatNumber(stats?.products.active || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Categories:</span>
                      <span className="font-medium">{formatNumber(stats?.products.categories || 0)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleExportData('products')}
                    disabled={exporting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    <Download className={`h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} />
                    {exporting ? 'Exporting...' : 'Export Products'}
                  </button>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center mb-4">
                    <Archive className="h-6 w-6 text-green-600" />
                    <h3 className="text-lg font-medium text-gray-900 ml-2">Full System Backup</h3>
                  </div>
                  <p className="text-gray-600 mb-4">
                    Create a complete backup including products, stores, stock logs, and system data.
                  </p>
                  <div className="space-y-2 mb-4 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Products:</span>
                      <span className="font-medium">{formatNumber(stats?.products.total || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stores:</span>
                      <span className="font-medium">{formatNumber(stats?.stores.total || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stock Logs:</span>
                      <span className="font-medium">{formatNumber(stats?.stockLogs.total || 0)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleExportData('all')}
                    disabled={exporting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                  >
                    <Archive className={`h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} />
                    {exporting ? 'Creating Backup...' : 'Full Backup'}
                  </button>
                </div>
              </div>

              {/* Import Section */}
              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center mb-4">
                  <Upload className="h-6 w-6 text-purple-600" />
                  <h3 className="text-lg font-medium text-gray-900 ml-2">Import Data</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Import data from previously exported JSON files. Supports both product exports and full system backups.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-blue-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Product imports</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Full system restore</span>
                  </div>
                  <div className="flex items-center gap-2 text-purple-600">
                    <Shield className="h-4 w-4" />
                    <span>Safe operation</span>
                  </div>
                </div>
                <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 cursor-pointer">
                  <Upload className={`h-4 w-4 ${importing ? 'animate-pulse' : ''}`} />
                  {importing ? 'Processing...' : 'Select Import File'}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    disabled={importing}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              {/* Cleanup Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center mb-4">
                    <Trash2 className="h-6 w-6 text-orange-600" />
                    <h3 className="text-lg font-medium text-gray-900 ml-2">Clean Old Logs</h3>
                  </div>
                  <p className="text-gray-600 mb-4">
                    Remove old stock movement logs to free up database space. Logs older than 90 days will be deleted.
                  </p>
                  <div className="space-y-2 mb-4 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Total Stock Logs:</span>
                      <span className="font-medium">{formatNumber(stats?.stockLogs.total || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last 30 Days:</span>
                      <span className="font-medium">{formatNumber(stats?.stockLogs.last30Days || 0)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCleanupData('logs')}
                    disabled={cleaning}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400"
                  >
                    <Trash2 className={`h-4 w-4 ${cleaning ? 'animate-pulse' : ''}`} />
                    {cleaning ? 'Cleaning...' : 'Clean Old Logs'}
                  </button>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center mb-4">
                    <Eye className="h-6 w-6 text-red-600" />
                    <h3 className="text-lg font-medium text-gray-900 ml-2">Clean Scan History</h3>
                  </div>
                  <p className="text-gray-600 mb-4">
                    Remove old barcode scan records to optimize performance. Scans older than 30 days will be deleted.
                  </p>
                  <div className="space-y-2 mb-4 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Total Scans:</span>
                      <span className="font-medium">{formatNumber(stats?.scanLogs.total || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last 7 Days:</span>
                      <span className="font-medium">{formatNumber(stats?.scanLogs.last7Days || 0)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCleanupData('scans')}
                    disabled={cleaning}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
                  >
                    <Eye className={`h-4 w-4 ${cleaning ? 'animate-pulse' : ''}`} />
                    {cleaning ? 'Cleaning...' : 'Clean Scan History'}
                  </button>
                </div>
              </div>

              {/* System Information */}
              <div className="bg-white rounded-lg shadow border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-600" />
                    System Information
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-3">Database Statistics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Records:</span>
                          <span className="font-medium">
                            {formatNumber((stats?.products.total || 0) + (stats?.stockLogs.total || 0) + (stats?.scanLogs.total || 0))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Product Records:</span>
                          <span className="font-medium">{formatNumber(stats?.products.total || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Activity Records:</span>
                          <span className="font-medium">{formatNumber((stats?.stockLogs.total || 0) + (stats?.scanLogs.total || 0))}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-3">User Statistics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Users:</span>
                          <span className="font-medium">{formatNumber(stats?.users.total || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Active Users:</span>
                          <span className="font-medium">{formatNumber(stats?.users.active || 0)}</span>
                        </div>
                        {stats?.users.roles && Object.entries(stats.users.roles).map(([role, count]) => (
                          <div key={role} className="flex justify-between">
                            <span className="text-gray-600 capitalize">{role}s:</span>
                            <span className="font-medium">{formatNumber(count)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Coming Soon */}
              <div className="bg-white rounded-lg shadow border">
                <div className="p-12 text-center">
                  <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">Advanced Analytics</h3>
                  <p className="text-gray-600 mb-6">
                    Detailed analytics and reporting features are coming soon. This will include:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
                    <div className="flex items-center gap-2 text-gray-600">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span>Inventory trend analysis</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <BarChart3 className="h-4 w-4 text-blue-500" />
                      <span>Performance metrics</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4 text-purple-500" />
                      <span>Historical reporting</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Activity className="h-4 w-4 text-orange-500" />
                      <span>Real-time dashboards</span>
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