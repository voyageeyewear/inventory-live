import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { Upload, TrendingUp, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface StockLog {
  _id: string
  sku: string
  change: number
  action: string
  timestamp: string
}

export default function StockIn() {
  const [stockLogs, setStockLogs] = useState<StockLog[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchStockLogs()
  }, [])

  const fetchStockLogs = async () => {
    try {
      const response = await axios.get('/api/stock-logs?action=Stock-In')
      setStockLogs(response.data)
    } catch (error) {
      toast.error('Failed to fetch stock logs')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('csv', file)

    try {
      const response = await axios.post('/api/stock/in', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      toast.success(`Successfully processed ${response.data.count} stock-in entries`)
      fetchStockLogs()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
      // Reset file input
      event.target.value = ''
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock-In</h1>
            <p className="text-gray-600">Add inventory to existing products</p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Stock-In CSV</h2>
          <div className="border-2 border-dashed border-green-300 rounded-lg p-6 bg-green-50">
            <div className="text-center">
              <TrendingUp className="mx-auto h-12 w-12 text-green-500" />
              <div className="mt-4">
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Upload Stock-In CSV
                  </span>
                  <span className="mt-1 block text-sm text-gray-500">
                    CSV format: SKU, Quantity (adds to existing stock)
                  </span>
                  <input
                    id="csv-upload"
                    name="csv-upload"
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <span className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
                    {uploading ? 'Processing...' : 'Choose File'}
                  </span>
                </label>
              </div>
            </div>
          </div>
          
          {/* Example format */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Example CSV Format:</h3>
            <pre className="text-xs text-gray-600">
{`SKU,Quantity
SKU123,20
SKU124,10
SKU125,5`}
            </pre>
          </div>
        </div>

        {/* Stock Logs */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Stock-In Activity</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              {stockLogs.length} entries
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading stock logs...</p>
            </div>
          ) : stockLogs.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">No stock-in activity yet. Upload a CSV to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity Added
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stockLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{log.sku}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          +{log.change}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{log.action}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
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
  )
}

