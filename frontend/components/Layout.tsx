import { useState } from 'react'
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
  Activity
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
  const router = useRouter()

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
              <button
                onClick={handleSync}
                disabled={syncing}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  syncing 
                    ? 'bg-gray-400 text-white cursor-not-allowed' 
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl border-2 border-red-700'
                }`}
                title="⚠️ WARNING: This will sync ALL products to ALL stores!"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing All Stores...' : '⚠️ Sync All Stores'}
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
    </div>
  )
}

