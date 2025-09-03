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
  CheckCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface LayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Products', href: '/', icon: Package },
  { name: 'Add Product', href: '/add-product', icon: Plus },
  { name: 'Sync Activity', href: '/sync-activity', icon: Activity },
  { name: 'Stock-In', href: '/stock-in', icon: TrendingUp },
  { name: 'Stock-Out', href: '/stock-out', icon: TrendingDown },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState({ count: 0, products: [] })
  const [loading, setLoading] = useState(false)
  const [showProductDetails, setShowProductDetails] = useState(false)
  const router = useRouter()

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

  // Load sync status on component mount and when router changes
  useEffect(() => {
    fetchSyncStatus()
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
      toast.info("Bulk sync cancelled by user");
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
              {/* Sync Status Indicator */}
              {syncStatus.count > 0 ? (
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
              ) : (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-700">
                    All products synced
                  </span>
                </div>
              )}

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

