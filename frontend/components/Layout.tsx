import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  Package,
  TrendingUp,
  TrendingDown,
  Settings,
  Menu,
  X,
  RefreshCw,
  BarChart3,
  Plus,
  Activity,
  AlertCircle,
  CheckCircle,
  FileText,
  Database,
  Users,
  LogOut,
  User as UserIcon,
  Scan,
  List,
  Clock,
  Shield
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

interface LayoutProps {
  children: React.ReactNode
}

const allNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3, permission: 'viewProducts' },
  { name: 'Products', href: '/', icon: Package, permission: 'viewProducts' },
  { name: 'Add Product', href: '/add-product', icon: Plus, permission: 'viewProducts' },
  { name: 'Barcode Scan', href: '/barcode-scan', icon: Scan, permission: 'viewProducts' },
  { name: 'Scan List', href: '/scan-list', icon: List, permission: 'viewProducts' },
  { name: 'Stock-In', href: '/stock-in', icon: TrendingUp, permission: 'viewProducts' },
  { name: 'Stock-Out', href: '/stock-out', icon: TrendingDown, permission: 'viewProducts' },
  { name: 'Data Management', href: '/data-management', icon: Database, permission: 'viewProducts' },
  { name: 'Sync Activity', href: '/sync-activity', icon: Activity, permission: 'viewProducts' },
  { name: 'Reports', href: '/reports', icon: FileText, permission: 'viewProducts' },
  { name: 'User Management', href: '/user-management', icon: Users, permission: 'viewProducts' },
  { name: 'Settings', href: '/settings', icon: Settings, permission: 'viewProducts' },
]

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState({ count: 0, products: [] })
  const [loading, setLoading] = useState(false)
  const [showProductDetails, setShowProductDetails] = useState(false)
  const [stores, setStores] = useState([])
  const [selectedStore, setSelectedStore] = useState('')
  const [showStoreSync, setShowStoreSync] = useState(false)
  const [syncingStore, setSyncingStore] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const router = useRouter()
  const { user, logout, hasPermission, token, isFullyAuthenticated } = useAuth()

  // Filter navigation based on user permissions
  const navigation = allNavigation.filter(item => hasPermission(item.permission))

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      const response = await axios.get('/api/products/needs-sync')
      setSyncStatus(response.data)
    } catch (error) {
      console.error('Error fetching sync status:', error)
    }
  }

  // Make fetchSyncStatus available globally for instant updates
  useEffect(() => {
    (window as any).refreshSyncStatus = fetchSyncStatus
    return () => {
      delete (window as any).refreshSyncStatus
    }
  }, [])

  // Mark all products as synced
  const handleMarkAllSynced = async () => {
    if (!window.confirm(`Mark all ${syncStatus.count} products as synced? This will clear the sync indicator.`)) {
      return
    }
    
    try {
      setLoading(true)
      await axios.post('/api/products/mark-all-synced')
      toast.success('All products marked as synced')
      fetchSyncStatus()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to mark products as synced')
    } finally {
      setLoading(false)
    }
  }

  // Fetch stores
  const fetchStores = async () => {
    try {
      const response = await axios.get('/api/stores')
      setStores(response.data.filter((store: any) => store.connected))
    } catch (error) {
      console.error('Error fetching stores:', error)
    }
  }

  // Handle sync by store
  const handleSyncByStore = async () => {
    if (!selectedStore) {
      toast.error('Please select a store first')
      return
    }

    const store = stores.find((s: any) => s._id === selectedStore)
    if (!store) {
      toast.error('Selected store not found')
      return
    }

    // Confirmation dialog
    const confirm = window.confirm(
      `🔄 SYNC TO SPECIFIC STORE\n\n` +
      `This will sync ${syncStatus.count} products to:\n` +
      `Store: ${(store as any).store_name}\n\n` +
      `Are you sure you want to continue?`
    )

    if (!confirm) {
      return
    }

    setSyncingStore(true)
    toast.loading(`Syncing to ${(store as any).store_name}...`, { duration: 3000 })
    
    try {
      const response = await axios.post(`/api/sync/store/${selectedStore}`)
      toast.success(`✅ Successfully synced ${response.data.totalProductsUpdated} products to ${response.data.storeUpdated}`)
      fetchSyncStatus() // Refresh sync status
      setShowStoreSync(false) // Close the dropdown
    } catch (error: any) {
      toast.error(`❌ Sync failed: ${error.response?.data?.message || 'Unknown error'}`)
    } finally {
      setSyncingStore(false)
    }
  }

  // Load sync status and stores on component mount and when router changes
  useEffect(() => {
    if (isFullyAuthenticated) {
      console.log('Layout: Making API calls - fully authenticated');
      fetchSyncStatus()
      fetchStores()
    }
  }, [router.pathname, isFullyAuthenticated])

  // Refresh sync status every 30 seconds
  useEffect(() => {
    if (isFullyAuthenticated) {
      const interval = setInterval(fetchSyncStatus, 30000)
      return () => clearInterval(interval)
    }
  }, [isFullyAuthenticated])

  const handleSync = async () => {
    // First confirmation with warning
    const firstConfirm = window.confirm(
      "⚠️ WARNING: BULK SYNC TO ALL STORES ⚠️\n\n" +
      "This will update inventory quantities for ALL products in ALL connected Shopify stores.\n\n" +
      "⚠️ This action cannot be undone!\n" +
      "⚠️ This may take several minutes to complete!\n" +
      "⚠️ This will overwrite current Shopify inventory!\n\n" +
      "Are you sure you want to continue?"
    );

    if (!firstConfirm) {
      return; // User cancelled
    }

    // Second confirmation - final warning
    const secondConfirm = window.confirm(
      "🚨 FINAL CONFIRMATION 🚨\n\n" +
      "This is your LAST CHANCE to cancel!\n\n" +
      "Clicking 'OK' will immediately start syncing ALL inventory to ALL stores.\n\n" +
      "✅ I understand this will overwrite Shopify inventory\n" +
      "✅ I understand this action cannot be undone\n" +
      "✅ I want to proceed with bulk sync\n\n" +
      "Click 'OK' to start sync, or 'Cancel' to abort."
    );

    if (!secondConfirm) {
      toast("Bulk sync cancelled by user", { icon: 'ℹ️' });
      return; // User cancelled on second confirmation
    }

    // User confirmed twice, proceed with sync
    setSyncing(true)
    toast.loading("Starting bulk sync to all stores...", { duration: 3000 });
    
    try {
      const response = await axios.post('/api/sync')
      toast.success(`✅ Successfully synced inventory to ${response.data.storesUpdated} stores`)
      // Refresh sync status after successful sync
      fetchSyncStatus()
    } catch (error: any) {
      toast.error(`❌ Sync failed: ${error.response?.data?.message || 'Unknown error'}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4">
            <h1 className="text-xl font-bold text-gray-900">Inventory Manager</h1>
            <button onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = router.pathname === item.href
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-primary-100 text-primary-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </a>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-4">
            <h1 className="text-xl font-bold text-gray-900">Inventory Manager</h1>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = router.pathname === item.href
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-primary-100 text-primary-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </a>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                {navigation.find(item => item.href === router.pathname)?.name || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Date and Time Display */}
              <div className="hidden md:flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{formatTime(currentTime)}</div>
                    <div className="text-xs text-gray-500">{formatDate(currentTime)}</div>
                  </div>
                </div>
              </div>

              {/* Admin Account Details */}
              <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-full">
                    <Shield className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold text-gray-900">{user?.username}</div>
                    <div className="text-xs text-gray-600 capitalize">{user?.role} Account</div>
                  </div>
                </div>
                
                {/* Logout Button */}
                <button
                  onClick={() => {
                    logout();
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:block">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      {/* Product Details Modal */}
      {showProductDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowProductDetails(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Products Needing Sync ({syncStatus.count})
                  </h3>
                  <button
                    onClick={() => setShowProductDetails(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>
              <div className="px-6 py-4 overflow-y-auto max-h-80">
                <div className="space-y-3">
                  {syncStatus.products.map((product: any) => (
                    <div key={product._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{product.product_name}</div>
                        <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                        <div className="text-sm text-gray-500">
                          Quantity: {product.quantity} | Last updated: {new Date(product.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="ml-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Needs Sync
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowProductDetails(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowProductDetails(false)
                      handleSync()
                    }}
                    disabled={syncing}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    Sync {syncStatus.count} Products
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

