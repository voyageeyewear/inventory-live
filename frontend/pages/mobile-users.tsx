import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { 
  Smartphone, 
  UserPlus, 
  Edit, 
  Trash2, 
  Shield, 
  Eye, 
  EyeOff, 
  Search,
  Filter,
  MoreVertical,
  Settings,
  Key,
  Mail,
  Calendar,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  Download,
  Upload,
  RefreshCw,
  MapPin,
  Wifi,
  QrCode,
  AlertCircle,
  CheckSquare,
  X,
  Monitor,
  Globe
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

interface MobileUser {
  id: number
  username: string
  email: string
  role: string
  device_name: string
  ip_address: string
  last_login: string
  is_active: boolean
  created_at: string
  updated_at: string
  total_scans: number
  pending_approvals: number
  approved_transactions: number
  rejected_transactions: number
}

interface MobileUserActivity {
  id: number
  user_id: number
  username: string
  email: string
  role: string
  barcode: string
  product_name: string
  sku: string
  action: string
  quantity: number
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  approved_at?: string
  approved_by?: number
  approver_name?: string
  notes?: string
  device_info: string
  ip_address: string
}

interface MobileUserStats {
  totalUsers: number
  activeUsers: number
  onlineUsers: number
  totalScans: number
  pendingApprovals: number
  approvedTransactions: number
  rejectedTransactions: number
}

export default function MobileUsers() {
  const [mobileUsers, setMobileUsers] = useState<MobileUser[]>([])
  const [activities, setActivities] = useState<MobileUserActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('users')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<MobileUser | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activityFilter, setActivityFilter] = useState('')
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    device_name: '',
    is_active: true
  })
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    device_name: '',
    is_active: true
  })
  const [stats, setStats] = useState<MobileUserStats>({
    totalUsers: 0,
    activeUsers: 0,
    onlineUsers: 0,
    totalScans: 0,
    pendingApprovals: 0,
    approvedTransactions: 0,
    rejectedTransactions: 0
  })

  const { user: currentUser, loading: authLoading } = useAuth()

  useEffect(() => {
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager')) {
      fetchMobileUsers()
      fetchMobileActivities()
    }
  }, [currentUser])

  const fetchMobileUsers = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/mobile-users')
      const usersData = response.data || []
      setMobileUsers(usersData)

      // Calculate statistics
      const totalUsers = usersData.length
      const activeUsers = usersData.filter((u: MobileUser) => u.is_active).length
      const onlineUsers = usersData.filter((u: MobileUser) => {
        if (!u.last_login) return false
        const lastLogin = new Date(u.last_login)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        return lastLogin > fiveMinutesAgo
      }).length
      const totalScans = usersData.reduce((sum: number, u: MobileUser) => sum + (u.total_scans || 0), 0)
      const pendingApprovals = usersData.reduce((sum: number, u: MobileUser) => sum + (u.pending_approvals || 0), 0)
      const approvedTransactions = usersData.reduce((sum: number, u: MobileUser) => sum + (u.approved_transactions || 0), 0)
      const rejectedTransactions = usersData.reduce((sum: number, u: MobileUser) => sum + (u.rejected_transactions || 0), 0)

      setStats({
        totalUsers,
        activeUsers,
        onlineUsers,
        totalScans,
        pendingApprovals,
        approvedTransactions,
        rejectedTransactions
      })

    } catch (error: any) {
      console.error('Failed to fetch mobile users:', error)
      const errorMessage = error.response?.data?.message || 'Failed to fetch mobile users'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const fetchMobileActivities = async () => {
    try {
      const params = new URLSearchParams()
      if (activityFilter) params.append('status', activityFilter)
      
      const response = await axios.get(`/api/mobile-activities?${params}`)
      setActivities(response.data || [])
    } catch (error: any) {
      console.error('Failed to fetch mobile activities:', error)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!createForm.username || !createForm.email || !createForm.password) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      // Create user through main users API with mobile access permissions
      const userData = {
        username: createForm.username,
        email: createForm.email,
        password: createForm.password,
        role: 'user', // Default role for mobile users
        permissions: ['viewProducts', 'scanProducts'], // Mobile app permissions
        is_active: createForm.is_active
      }
      
      await axios.post('/api/users', userData)
      toast.success('Mobile user created successfully')
      setCreateForm({
        username: '',
        email: '',
        password: '',
        device_name: '',
        is_active: true
      })
      setShowCreateModal(false)
      fetchMobileUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create mobile user')
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedUser || !editForm.username || !editForm.email) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      await axios.put(`/api/mobile-users/${selectedUser.id}`, editForm)
      toast.success('Mobile user updated successfully')
      setShowEditModal(false)
      setSelectedUser(null)
      fetchMobileUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update mobile user')
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this mobile user? This action cannot be undone.')) return

    try {
      await axios.delete(`/api/mobile-users/${userId}`)
      toast.success('Mobile user deleted successfully')
      fetchMobileUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete mobile user')
    }
  }

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await axios.put(`/api/mobile-users/${userId}`, { is_active: !currentStatus })
      toast.success(`Mobile user ${!currentStatus ? 'activated' : 'deactivated'} successfully`)
      fetchMobileUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update user status')
    }
  }

  const handleApproveTransaction = async (activityId: number) => {
    try {
      await axios.post(`/api/mobile-activities/${activityId}/approve`)
      toast.success('Transaction approved successfully')
      fetchMobileActivities()
      fetchMobileUsers() // Refresh stats
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve transaction')
    }
  }

  const handleRejectTransaction = async (activityId: number, notes?: string) => {
    try {
      await axios.post(`/api/mobile-activities/${activityId}/reject`, { notes })
      toast.success('Transaction rejected successfully')
      fetchMobileActivities()
      fetchMobileUsers() // Refresh stats
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reject transaction')
    }
  }

  const openEditModal = (user: MobileUser) => {
    setSelectedUser(user)
    setEditForm({
      username: user.username,
      email: user.email,
      device_name: user.device_name,
      is_active: user.is_active
    })
    setShowEditModal(true)
  }

  const exportMobileUsers = () => {
    const exportData = {
      generated_at: new Date().toISOString(),
      total_users: mobileUsers.length,
      statistics: stats,
      users: mobileUsers.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        device_name: user.device_name,
        ip_address: user.ip_address,
        last_login: user.last_login,
        is_active: user.is_active,
        total_scans: user.total_scans,
        pending_approvals: user.pending_approvals,
        approved_transactions: user.approved_transactions,
        rejected_transactions: user.rejected_transactions
      }))
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mobile_users_export_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Mobile users exported successfully')
  }

  // Filter users and activities
  const filteredUsers = mobileUsers.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.device_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || 
                         (statusFilter === 'active' && user.is_active) ||
                         (statusFilter === 'inactive' && !user.is_active)
    
    return matchesSearch && matchesStatus
  })

  const filteredActivities = activities.filter(activity => {
    return !activityFilter || activity.status === activityFilter
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return formatDate(dateString)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const tabs = [
    { id: 'users', name: 'Mobile Users', icon: Smartphone },
    { id: 'activity', name: 'Scan Activity', icon: QrCode },
    { id: 'approvals', name: 'Pending Approvals', icon: CheckSquare },
    { id: 'devices', name: 'Device Management', icon: Monitor }
  ]

  // Show loading while authentication is in progress
  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading...</span>
        </div>
      </Layout>
    )
  }

  // Check if user has admin or manager role
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
    return (
      <Layout>
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-500">Admin or Manager access required to manage mobile users.</p>
        </div>
      </Layout>
    )
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Smartphone className="h-8 w-8 text-blue-600" />
                Mobile User Management
              </h1>
              <p className="text-gray-600 mt-1">Manage mobile app users, track activity, and approve transactions</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportMobileUsers}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                Add Mobile User
              </button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <Smartphone className="h-8 w-8 text-blue-600 bg-blue-100 rounded-lg p-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-green-600 bg-green-100 rounded-lg p-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.activeUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <Wifi className="h-8 w-8 text-emerald-600 bg-emerald-100 rounded-lg p-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Online</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.onlineUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <QrCode className="h-8 w-8 text-purple-600 bg-purple-100 rounded-lg p-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Scans</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.totalScans}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600 bg-yellow-100 rounded-lg p-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pendingApprovals}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600 bg-green-100 rounded-lg p-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{stats.approvedTransactions}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <XCircle className="h-8 w-8 text-red-600 bg-red-100 rounded-lg p-2" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejectedTransactions}</p>
                </div>
              </div>
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
                  {tab.id === 'approvals' && stats.pendingApprovals > 0 && (
                    <span className="ml-1 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                      {stats.pendingApprovals}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading mobile users...</span>
            </div>
          ) : (
            <>
              {/* Mobile Users Tab */}
              {activeTab === 'users' && (
                <div className="space-y-6">
                  {/* Search and Filters */}
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search by username, email, or device..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Status</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                        <button
                          onClick={fetchMobileUsers}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Users Table */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                        <Smartphone className="h-5 w-5" />
                        Mobile App Users ({filteredUsers.length})
                      </h2>
                    </div>

                    {filteredUsers.length === 0 ? (
                      <div className="p-8 text-center">
                        <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No mobile users found</h3>
                        <p className="text-gray-500">
                          {searchTerm || statusFilter 
                            ? 'Try adjusting your search or filters.'
                            : 'Get started by creating your first mobile user.'
                          }
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device Info</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredUsers.map((user) => (
                              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                        <span className="text-sm font-medium text-blue-700">
                                          {user.username.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">{user.username}</div>
                                      <div className="text-sm text-gray-500">{user.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    <div className="flex items-center gap-1">
                                      <Monitor className="h-4 w-4 text-gray-400" />
                                      {user.device_name || 'Unknown Device'}
                                    </div>
                                    <div className="flex items-center gap-1 text-gray-500">
                                      <Globe className="h-4 w-4 text-gray-400" />
                                      {user.ip_address || 'N/A'}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {user.is_active ? (
                                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-500 mr-2" />
                                    )}
                                    <span className={`text-sm ${
                                      user.is_active ? 'text-green-800' : 'text-red-800'
                                    }`}>
                                      {user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <div className="space-y-1">
                                    <div>Scans: {user.total_scans || 0}</div>
                                    <div className="text-yellow-600">Pending: {user.pending_approvals || 0}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {user.last_login ? formatRelativeTime(user.last_login) : 'Never'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => openEditModal(user)}
                                      className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                                      title="Edit user"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                                      className={`p-1 rounded transition-colors ${
                                        user.is_active 
                                          ? 'text-red-600 hover:text-red-900 hover:bg-red-50'
                                          : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                      }`}
                                      title={user.is_active ? 'Deactivate user' : 'Activate user'}
                                    >
                                      {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                                      title="Delete user"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Scan Activity Tab */}
              {activeTab === 'activity' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Mobile Scan Activity</h2>
                    <select
                      value={activityFilter}
                      onChange={(e) => {
                        setActivityFilter(e.target.value)
                        fetchMobileActivities()
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scanned At</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredActivities.slice(0, 50).map((activity) => (
                            <tr key={activity.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {activity.username}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{activity.product_name}</div>
                                  <div className="text-sm text-gray-500">SKU: {activity.sku}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{activity.action}</div>
                                <div className="text-sm text-gray-500">Qty: {activity.quantity}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(activity.status)}`}>
                                  {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatRelativeTime(activity.created_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div>{activity.device_info}</div>
                                <div className="text-xs">{activity.ip_address}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Approvals Tab */}
              {activeTab === 'approvals' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Pending Approvals</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {filteredActivities.filter(a => a.status === 'pending').length} pending transactions
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {filteredActivities
                      .filter(activity => activity.status === 'pending')
                      .map((activity) => (
                        <div key={activity.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-4">
                                <div className="flex-shrink-0 h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                  <QrCode className="h-6 w-6 text-yellow-600" />
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-lg font-medium text-gray-900">{activity.product_name}</h3>
                                  <div className="mt-1 text-sm text-gray-500">
                                    <span>SKU: {activity.sku}</span>
                                    <span className="mx-2">•</span>
                                    <span>User: {activity.username}</span>
                                    <span className="mx-2">•</span>
                                    <span>Action: {activity.action}</span>
                                    <span className="mx-2">•</span>
                                    <span>Quantity: {activity.quantity}</span>
                                  </div>
                                  <div className="mt-2 text-xs text-gray-400">
                                    <span>Scanned: {formatRelativeTime(activity.created_at)}</span>
                                    <span className="mx-2">•</span>
                                    <span>Device: {activity.device_info}</span>
                                    <span className="mx-2">•</span>
                                    <span>IP: {activity.ip_address}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRejectTransaction(activity.id, 'Rejected by admin')}
                                className="flex items-center gap-2 px-4 py-2 text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                              >
                                <X className="h-4 w-4" />
                                Reject
                              </button>
                              <button
                                onClick={() => handleApproveTransaction(activity.id)}
                                className="flex items-center gap-2 px-4 py-2 text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Approve
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                    {filteredActivities.filter(a => a.status === 'pending').length === 0 && (
                      <div className="text-center py-12">
                        <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No pending approvals</h3>
                        <p className="text-gray-500">All transactions have been processed.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Device Management Tab */}
              {activeTab === 'devices' && (
                <div className="space-y-6">
                  <div className="text-center py-12">
                    <Monitor className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-gray-900 mb-2">Device Management</h3>
                    <p className="text-gray-500 mb-6">Coming soon - Advanced device tracking and management</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <MapPin className="h-8 w-8 text-blue-600 mb-3" />
                        <h4 className="font-medium text-gray-900 mb-2">Location Tracking</h4>
                        <p className="text-sm text-gray-500">Track device locations and scan locations</p>
                      </div>
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <Shield className="h-8 w-8 text-green-600 mb-3" />
                        <h4 className="font-medium text-gray-900 mb-2">Device Security</h4>
                        <p className="text-sm text-gray-500">Manage device permissions and security settings</p>
                      </div>
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <Activity className="h-8 w-8 text-purple-600 mb-3" />
                        <h4 className="font-medium text-gray-900 mb-2">Usage Analytics</h4>
                        <p className="text-sm text-gray-500">Detailed device usage and performance metrics</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Create Mobile User Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                    Create New Mobile User
                  </h3>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Username *</label>
                      <input
                        type="text"
                        required
                        value={createForm.username}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter username"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email *</label>
                      <input
                        type="email"
                        required
                        value={createForm.email}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter email address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Password *</label>
                      <input
                        type="password"
                        required
                        value={createForm.password}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Device Name</label>
                      <input
                        type="text"
                        value={createForm.device_name}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, device_name: e.target.value }))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter device name (optional)"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={createForm.is_active}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                        Active user
                      </label>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                      >
                        Create User
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Edit Mobile User Modal */}
          {showEditModal && selectedUser && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Edit className="h-5 w-5 text-blue-600" />
                    Edit Mobile User: {selectedUser.username}
                  </h3>
                  <form onSubmit={handleEditUser} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Username *</label>
                      <input
                        type="text"
                        required
                        value={editForm.username}
                        onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email *</label>
                      <input
                        type="email"
                        required
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Device Name</label>
                      <input
                        type="text"
                        value={editForm.device_name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, device_name: e.target.value }))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="edit_is_active"
                        checked={editForm.is_active}
                        onChange={(e) => setEditForm(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="edit_is_active" className="ml-2 block text-sm text-gray-700">
                        Active user
                      </label>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditModal(false)
                          setSelectedUser(null)
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                      >
                        Update User
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
