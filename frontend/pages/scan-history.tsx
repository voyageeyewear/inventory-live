import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { 
  History,
  Search,
  Filter,
  Calendar,
  User,
  Package,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Smartphone,
  BarChart3,
  RefreshCw
} from 'lucide-react'

interface ScanHistoryItem {
  id: number
  sku: string
  transaction_type: string
  quantity: number
  notes: string
  status: string
  scanned_by: string
  approved_by_username: string | null
  scanned_at: string
  approved_at: string | null
  product_name: string
  image_url: string | null
  category: string
  current_stock: number
  source_type: string
}

interface ScanHistoryStats {
  total_scans: number
  pending_scans: number
  approved_scans: number
  rejected_scans: number
  stock_in_scans: number
  stock_out_scans: number
  unique_users: number
  unique_products: number
}

interface RecentActivity {
  scan_date: string
  scan_count: number
  stock_in_count: number
  stock_out_count: number
}

export default function ScanHistory() {
  const { user, isFullyAuthenticated } = useAuth()
  const [scans, setScans] = useState<ScanHistoryItem[]>([])
  const [stats, setStats] = useState<ScanHistoryStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (isFullyAuthenticated) {
      fetchScanHistory()
    }
  }, [isFullyAuthenticated, currentPage, searchTerm, userFilter])

  const fetchScanHistory = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        search: searchTerm,
        user_filter: userFilter
      })

      const response = await axios.get(`/api/scan-history?${params}`)
      
      if (response.data.success) {
        setScans(response.data.data.scans)
        setStats(response.data.data.stats)
        setRecentActivity(response.data.data.recent_activity)
        setTotalPages(response.data.data.pagination.totalPages)
      }
    } catch (error: any) {
      console.error('Fetch scan history error:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch scan history')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchScanHistory()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTransactionIcon = (type: string) => {
    return type === 'stock_in' ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    )
  }

  if (loading && scans.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <ProtectedRoute requiredPermission="viewProducts">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <History className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Scan History</h1>
                  <p className="text-gray-600">View all barcode scans and mobile app transactions</p>
                </div>
              </div>
              <button
                onClick={fetchScanHistory}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium text-blue-800">Refresh</span>
              </button>
            </div>
          </div>

          {/* Statistics Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Scans</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total_scans}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.pending_scans}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Approved</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.approved_scans}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Package className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Unique Products</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.unique_products}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="bg-white shadow rounded-lg p-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by SKU or product name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filter by user..."
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Search
              </button>
            </form>
          </div>

          {/* Scan History List */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Scans</h3>
            </div>
            
            {scans.length === 0 ? (
              <div className="p-12 text-center">
                <Smartphone className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No scan history found</h3>
                <p className="text-gray-600">Start using the mobile app to scan barcodes and they'll appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {scans.map((scan) => (
                  <div key={scan.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        {/* Product Image */}
                        <div className="flex-shrink-0">
                          {scan.image_url ? (
                            <img
                              src={scan.image_url}
                              alt={scan.product_name}
                              className="w-16 h-16 object-cover rounded-lg"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyNEMzMiAyNCAzNiAyOCAzNiA0MEMzNiA1MiAzMiA1NiAyMCA1NkM4IDU2IDQgNTIgNCA0MEM0IDI4IDggMjQgMjAgMjRaIiBmaWxsPSIjRTVFN0VCIi8+Cjwvc3ZnPgo='
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                              <Package className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Scan Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-lg font-medium text-gray-900 truncate">
                              {scan.product_name}
                            </h4>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(scan.status)}`}>
                              {getStatusIcon(scan.status)}
                              {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Package className="h-4 w-4" />
                              <span>SKU: {scan.sku}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {getTransactionIcon(scan.transaction_type)}
                              <span>{scan.transaction_type.replace('_', ' ').toUpperCase()}: {scan.quantity}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>By: {scan.scanned_by}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(scan.scanned_at)}</span>
                            </div>
                          </div>

                          {scan.notes && (
                            <div className="mt-2">
                              <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                <strong>Notes:</strong> {scan.notes}
                              </p>
                            </div>
                          )}

                          {scan.approved_by_username && scan.approved_at && (
                            <div className="mt-2 text-sm text-gray-600">
                              <span>Approved by {scan.approved_by_username} on {formatDate(scan.approved_at)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Current Stock */}
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Current Stock</p>
                        <p className="text-lg font-semibold text-gray-900">{scan.current_stock}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
