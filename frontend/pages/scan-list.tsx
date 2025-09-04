import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { Trash2, RefreshCw, Package, Calendar, Hash, DollarSign } from 'lucide-react'

interface ScanLog {
  _id: string
  sku: string
  product_name: string
  quantity: number
  price: number
  category: string
  last_scanned: string
  scan_count: number
  createdAt: string
}

export default function ScanList() {
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchScanLogs = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/scan-logs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setScanLogs(data)
        setError('')
      } else {
        setError('Failed to fetch scan logs')
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Error fetching scan logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const clearAllScans = async () => {
    if (!confirm('Are you sure you want to clear all scanned items?')) {
      return
    }
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/scan-logs', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        setScanLogs([])
        setError('')
      } else {
        setError('Failed to clear scan logs')
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Error clearing scan logs:', err)
    }
  }

  const deleteScanLog = async (id: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/scan-logs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        setScanLogs(scanLogs.filter(log => log._id !== id))
        setError('')
      } else {
        setError('Failed to delete scan log')
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Error deleting scan log:', err)
    }
  }

  const updateQuantity = async (id: string, newQuantity: number) => {
    if (newQuantity < 1) return
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/scan-logs/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quantity: newQuantity })
      })
      
      if (response.ok) {
        const result = await response.json()
        setScanLogs(scanLogs.map(log => 
          log._id === id ? result.data : log
        ))
        setError('')
      } else {
        setError('Failed to update quantity')
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Error updating quantity:', err)
    }
  }

  useEffect(() => {
    fetchScanLogs()
    
    // Auto-refresh every 5 seconds to catch new scans from mobile app
    const interval = setInterval(fetchScanLogs, 5000)
    return () => clearInterval(interval)
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const totalItems = scanLogs.reduce((sum, log) => sum + log.quantity, 0)
  const totalValue = scanLogs.reduce((sum, log) => sum + (log.quantity * log.price), 0)

  return (
    <ProtectedRoute requiredPermission="viewProducts">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Scan List</h1>
              <p className="text-gray-600">Products scanned via mobile app</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchScanLogs}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              {scanLogs.length > 0 && (
                <button
                  onClick={clearAllScans}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{scanLogs.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center gap-3">
                <Hash className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Items</p>
                  <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">${totalValue.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Scan Logs Table */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading scan logs...</p>
              </div>
            ) : scanLogs.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No scanned products</h3>
                <p className="text-gray-600">Start scanning products with the mobile app to see them here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Scans
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Scanned
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {scanLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {log.product_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-mono">
                            {log.sku}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {log.category || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(log._id, log.quantity - 1)}
                              className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-sm font-medium"
                              disabled={log.quantity <= 1}
                            >
                              -
                            </button>
                            <span className="text-sm font-medium text-gray-900 min-w-[2rem] text-center">
                              {log.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(log._id, log.quantity + 1)}
                              className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-sm font-medium"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            ${log.price.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {log.scan_count}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDate(log.last_scanned)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => deleteScanLog(log._id)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
