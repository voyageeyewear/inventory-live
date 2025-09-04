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
  List
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

interface LayoutProps {
  children: React.ReactNode
}

const allNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3, permission: 'viewDashboard' },
  { name: 'Products', href: '/', icon: Package, permission: 'viewProducts' },
  { name: 'Add Product', href: '/add-product', icon: Plus, permission: 'addProducts' },
  { name: 'Barcode Scan', href: '/barcode-scan', icon: Scan, permission: 'viewProducts' },
  { name: 'Scan List', href: '/scan-list', icon: List, permission: 'viewProducts' },
  { name: 'Sync Activity', href: '/sync-activity', icon: Activity, permission: 'viewSyncActivity' },
  { name: 'Reports', href: '/reports', icon: FileText, permission: 'viewReports' },
  { name: 'Data Management', href: '/data-management', icon: Database, permission: 'viewDataManagement' },
  { name: 'User Management', href: '/user-management', icon: Users, permission: 'viewUsers' },
  { name: 'Stock-In', href: '/stock-in', icon: TrendingUp, permission: 'stockIn' },
  { name: 'Stock-Out', href: '/stock-out', icon: TrendingDown, permission: 'stockOut' },
  { name: 'Settings', href: '/settings', icon: Settings, permission: 'manageStores' }, // Admin/Manager only
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
  const router = useRouter()
  const { user, logout, hasPermission } = useAuth()

  // Filter navigation based on user permissions
  const navigation = allNavigation.filter(item => hasPermission(item.permission))

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
    fetchSyncStatus()
    fetchStores()
  }, [router.pathname])

  // Refresh sync status every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchSyncStatus, 30000)
    return () => clearInterval(interval)
  }, [])

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
                          {/* Sync Status Indicator - Only show if user has sync permissions */}
            {hasPermission('syncProducts') && syncStatus.count > 0 ? (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <button
                    onClick={() => setShowProductDetails(true)}
                    className="text-sm font-medium text-orange-700 hover:text-orange-800 underline"
                    title="Click to see product details"
                  >
                    {syncStatus.count} product{syncStatus.count !== 1 ? 's' : ''} need syncing
                  </button>
                  <button
                    onClick={handleMarkAllSynced}
                    disabled={loading}
                    className="ml-2 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-1 rounded transition-colors"
                    title="Mark all products as synced (clears indicator)"
                  >
                    {loading ? 'Marking...' : 'Mark All'}
                  </button>
                </div>
              ) : hasPermission('syncProducts') ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-700">
                    All products synced
                  </span>
                </div>
              ) : null}

              {/* Sync All Stores Button - Only show if user has sync permissions */}
              {hasPermission('syncAllStores') && (
                <button
                onClick={handleSync}
                disabled={syncing || syncStatus.count === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  syncing 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : syncStatus.count > 0
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl border-2 border-blue-700'
                      : 'bg-gray-400 text-white cursor-not-allowed'
                }`}
                title={syncStatus.count > 0 ? `Sync ${syncStatus.count} modified products to all stores` : "No products need syncing"}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : syncStatus.count > 0 ? `Sync ${syncStatus.count} Products` : 'All Synced'}
              </button>
              )}

              {/* Sync By Store Button - Only show if user has sync permissions */}
              {hasPermission('syncProducts') && syncStatus.count > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowStoreSync(!showStoreSync)}
                    disabled={syncingStore || stores.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl border-2 border-green-700"
                    title="Sync to a specific store only"
                  >
                    <Package className="h-4 w-4" />
                    Sync By Store
                  </button>

                  {/* Store Selection Dropdown */}
                  {showStoreSync && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                      <div className="p-4">
                        <h3 className="text-sm font-medium text-gray-900 mb-3">Select Store to Sync</h3>
                        <select
                          value={selectedStore}
                          onChange={(e) => setSelectedStore(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Choose a store...</option>
                          {stores.map((store: any) => (
                            <option key={store._id} value={store._id}>
                              {store.store_name} ({store.store_domain})
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={handleSyncByStore}
                            disabled={!selectedStore || syncingStore}
                            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:bg-gray-400"
                          >
                            {syncingStore ? 'Syncing...' : `Sync ${syncStatus.count} Products`}
                          </button>
                          <button
                            onClick={() => setShowStoreSync(false)}
                            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <UserIcon className="h-5 w-5" />
                <span className="hidden md:block">{user?.username}</span>
                <span className="text-xs text-gray-500 hidden lg:block">({user?.role})</span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                      <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
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

