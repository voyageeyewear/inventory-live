import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { Plus, Store, Trash2, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

interface ShopifyStore {
  id: string
  store_name: string
  store_domain: string
  access_token: string
  connected: boolean
}

export default function Settings() {
  const [stores, setStores] = useState<ShopifyStore[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    store_name: '',
    store_domain: '',
    access_token: ''
  })

  const { user, isFullyAuthenticated } = useAuth()

  useEffect(() => {
    if (isFullyAuthenticated) {
      console.log('Settings: Making API call - fully authenticated')
      fetchStores()
    }
  }, [isFullyAuthenticated])

  const fetchStores = async () => {
    try {
      setLoading(true)
      console.log('Fetching stores...')
      const response = await axios.get('/api/stores')
      console.log('Stores response:', response.data)
      setStores(response.data)
    } catch (error: any) {
      console.error('Fetch stores error:', error)
      console.error('Error response:', error.response?.data)
      toast.error(error.response?.data?.message || 'Failed to fetch stores')
    } finally {
      setLoading(false)
    }
  }

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.store_name || !formData.store_domain || !formData.access_token) {
      toast.error('Please fill in all fields')
      return
    }

    try {
      await axios.post('/api/stores', formData)
      toast.success('Store added successfully')
      setFormData({ store_name: '', store_domain: '', access_token: '' })
      setShowAddForm(false)
      fetchStores()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add store')
    }
  }

  const handleDeleteStore = async (storeId: string) => {
    if (!confirm('Are you sure you want to delete this store?')) return

    try {
      await axios.delete(`/api/stores/${storeId}`)
      toast.success('Store deleted successfully')
      fetchStores()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete store')
    }
  }

  const testConnection = async (storeId: string) => {
    try {
      const response = await axios.post(`/api/stores/${storeId}/test`)
      if (response.data.success) {
        toast.success('Connection successful!')
      } else {
        toast.error('Connection failed')
      }
      fetchStores()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Connection test failed')
    }
  }

  const addDevelopmentStore = async () => {
    try {
      const response = await axios.post('/api/stores/add-development-store')
      if (response.data.success) {
        toast.success(response.data.message)
        fetchStores()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add Development Store')
    }
  }

  const testSync = async (storeId: string) => {
    try {
      toast.loading('Testing sync functionality...', { duration: 3000 })
      const response = await axios.post('/api/stores/test-sync', { storeId })
      
      if (response.data.success) {
        const { summary, results } = response.data
        toast.success(`✅ Sync test completed: ${summary.successful}/${summary.total_products_tested} products ready`)
        
        // Show detailed results in console
        console.log('Sync Test Results:', results)
        console.log('Summary:', summary)
        
        fetchStores()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Sync test failed')
    }
  }

  return (
    <ProtectedRoute requiredPermission="manageStores">
      <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">Manage your Shopify store connections</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={addDevelopmentStore}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
            >
              <Store className="h-4 w-4" />
              Add Development Store
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Store
            </button>
          </div>
        </div>

        {/* Add Store Form */}
        {showAddForm && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Shopify Store</h2>
            <form onSubmit={handleAddStore} className="space-y-4">
              <div>
                <label htmlFor="store_name" className="block text-sm font-medium text-gray-700">
                  Store Name
                </label>
                <input
                  type="text"
                  id="store_name"
                  value={formData.store_name}
                  onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                  className="input-field mt-1"
                  placeholder="My Shopify Store"
                />
              </div>
              <div>
                <label htmlFor="store_domain" className="block text-sm font-medium text-gray-700">
                  Store Domain
                </label>
                <input
                  type="text"
                  id="store_domain"
                  value={formData.store_domain}
                  onChange={(e) => setFormData({ ...formData, store_domain: e.target.value })}
                  className="input-field mt-1"
                  placeholder="mystore.myshopify.com"
                />
              </div>
              <div>
                <label htmlFor="access_token" className="block text-sm font-medium text-gray-700">
                  Access Token
                </label>
                <input
                  type="password"
                  id="access_token"
                  value={formData.access_token}
                  onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                  className="input-field mt-1"
                  placeholder="shpat_..."
                />
                <p className="mt-1 text-sm text-gray-500">
                  Get your access token from your Shopify admin panel
                </p>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary">
                  Add Store
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stores List */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Connected Stores</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Store className="h-4 w-4" />
              {stores.length} stores
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading stores...</p>
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-8">
              <Store className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">No stores connected yet. Add your first store to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stores.map((store) => (
                <div key={store.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <Store className="h-8 w-8 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{store.store_name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-gray-500">{store.store_domain}</p>
                          <a
                            href={`https://${store.store_domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {store.connected ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-xs font-medium ${
                          store.connected ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {store.connected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      <button
                        onClick={() => testConnection(store.id)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Test
                      </button>
                      <button
                        onClick={() => testSync(store.id)}
                        className="text-sm text-green-600 hover:text-green-700 font-medium"
                        disabled={!store.connected}
                        title={store.connected ? 'Test sync functionality' : 'Connect store first'}
                      >
                        Sync Test
                      </button>
                      <button
                        onClick={() => handleDeleteStore(store.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">How to get your Shopify Access Token</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>1. Go to your Shopify admin panel</p>
            <p>2. Navigate to Apps → Manage private apps</p>
            <p>3. Create a private app or use an existing one</p>
            <p>4. Enable "Read and write" permissions for Products and Inventory</p>
            <p>5. Copy the Admin API access token (starts with "shpat_")</p>
          </div>
        </div>
      </div>
      </Layout>
    </ProtectedRoute>
  )
}

