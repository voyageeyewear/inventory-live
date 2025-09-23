import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { Upload, TrendingDown, Clock, RefreshCw, CheckCircle, AlertCircle, Download, FileText, BarChart3, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface StockLog {
  id: number
  sku: string
  quantity: number
  previous_quantity: number
  new_quantity: number
  type: string
  notes: string
  user_name: string
  created_at: string
  product_name: string
}

interface UploadResults {
  processed: number
  errors: string[]
  success: string[]
  duplicates?: { [key: string]: { count: number, quantities: number[] } }
  originalRows?: number
  consolidatedRows?: number
  totalRows?: number
  fileName?: string
  uploadTime?: string
}

export default function StockOut() {
  const { user, isFullyAuthenticated } = useAuth()
  const [stockLogs, setStockLogs] = useState<StockLog[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<UploadResults | null>(null)

  useEffect(() => {
    if (isFullyAuthenticated) {
      fetchStockLogs()
    }
  }, [isFullyAuthenticated])

  const fetchStockLogs = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/stock-logs?type=stock_out&limit=50')
      setStockLogs(response.data.stockLogs || [])
    } catch (error: any) {
      console.error('Fetch stock logs error:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch stock logs')
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
    setUploadResults(null)
    const formData = new FormData()
    formData.append('csv', file)

    try {
      const response = await axios.post('/api/stock/bulk-out', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      
      if (response.data.success) {
        toast.success(`Successfully processed ${response.data.count} stock-out entries`)
        const results = {
          ...response.data.results,
          fileName: file.name,
          uploadTime: new Date().toISOString(),
          totalRows: response.data.results.originalRows || (response.data.results.processed + response.data.results.errors.length)
        }
        setUploadResults(results)
        fetchStockLogs()
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.response?.data?.message || 'Upload failed')
      if (error.response?.data?.results) {
        const results = {
          ...error.response.data.results,
          fileName: file.name,
          uploadTime: new Date().toISOString(),
          totalRows: error.response.data.results.originalRows || ((error.response.data.results.processed || 0) + (error.response.data.results.errors?.length || 0))
        }
        setUploadResults(results)
      }
    } finally {
      setUploading(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const exportReport = () => {
    if (!uploadResults) return

    const csvContent = [
      ['Stock-Out Report'],
      ['File Name:', uploadResults.fileName || 'Unknown'],
      ['Upload Time:', uploadResults.uploadTime ? new Date(uploadResults.uploadTime).toLocaleString() : 'Unknown'],
      ['Total Rows Processed:', uploadResults.totalRows?.toString() || '0'],
      ['Original Rows:', uploadResults.originalRows?.toString() || '0'],
      ['Consolidated Rows:', uploadResults.consolidatedRows?.toString() || '0'],
      ['Successfully Updated:', uploadResults.processed.toString()],
      ['Errors:', uploadResults.errors.length.toString()],
      [''],
      ['Successfully Updated Products:'],
      ['SKU', 'Quantity Change', 'Stock Movement'],
      ...uploadResults.success.map(item => {
        const parts = item.split(': ')
        const sku = parts[0]
        const details = parts[1] || ''
        return [sku, details, details]
      }),
      [''],
      ['Errors:'],
      ['SKU/Issue', 'Error Description'],
      ...uploadResults.errors.map(error => {
        const parts = error.split(': ')
        return [parts[0] || '', parts[1] || error]
      })
    ]

    // Add consolidation details if available
    if (uploadResults.duplicates && Object.keys(uploadResults.duplicates).length > 0) {
      csvContent.push(
        [''],
        ['Consolidated Duplicate SKUs:'],
        ['SKU', 'Duplicate Count', 'Individual Quantities', 'Total Quantity'],
        ...Object.entries(uploadResults.duplicates).map(([sku, info]) => [
          sku,
          info.count.toString(),
          info.quantities.join(' + '),
          info.quantities.reduce((a, b) => a + b, 0).toString()
        ])
      )
    }

    const csvString = csvContent.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `stock-out-report-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <ProtectedRoute requiredPermission="viewProducts">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock-Out</h1>
              <p className="text-gray-600">Remove inventory from existing products via CSV upload</p>
            </div>
            <button
              onClick={fetchStockLogs}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium text-blue-800">Refresh</span>
            </button>
          </div>

        {/* Upload Section */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Stock-Out CSV</h2>
          <div className="border-2 border-dashed border-red-300 rounded-lg p-6 bg-red-50">
            <div className="text-center">
              <TrendingDown className="mx-auto h-12 w-12 text-red-500" />
              <div className="mt-4">
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Upload Stock-Out CSV
                  </span>
                  <span className="mt-1 block text-sm text-gray-500">
                    CSV format: SKU, Quantity (removes from existing stock)
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
                  <span className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700">
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
SKU123,5
SKU124,8
SKU125,2`}
            </pre>
          </div>
        </div>

        {/* Upload Results Report */}
        {uploadResults && (
          <div className="bg-white rounded-lg shadow border">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-blue-600" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Stock-Out Processing Report</h3>
                  <p className="text-sm text-gray-500">
                    {uploadResults.fileName} • {uploadResults.uploadTime ? new Date(uploadResults.uploadTime).toLocaleString() : 'Just now'}
                  </p>
                </div>
              </div>
              <button
                onClick={exportReport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export Report
              </button>
            </div>
            
            <div className="p-6">
              {/* Summary Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Total Rows</p>
                      <p className="text-2xl font-bold text-blue-900">{uploadResults.totalRows || 0}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Successful</p>
                      <p className="text-2xl font-bold text-green-900">{uploadResults.processed}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Errors</p>
                      <p className="text-2xl font-bold text-red-900">{uploadResults.errors.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-purple-800">Success Rate</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {uploadResults.totalRows ? Math.round((uploadResults.processed / uploadResults.totalRows) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Consolidation Summary */}
              {uploadResults.duplicates && Object.keys(uploadResults.duplicates).length > 0 && (
                <div className="mb-6">
                  <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="h-5 w-5 text-yellow-600" />
                      <h4 className="text-lg font-semibold text-gray-900">Duplicate SKUs Consolidated</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-800">{uploadResults.originalRows || 0}</p>
                        <p className="text-sm text-yellow-700">Original Rows</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-800">{uploadResults.consolidatedRows || 0}</p>
                        <p className="text-sm text-yellow-700">After Consolidation</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-800">{Object.keys(uploadResults.duplicates).length}</p>
                        <p className="text-sm text-yellow-700">SKUs with Duplicates</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-900">Consolidated SKUs:</h5>
                      {Object.entries(uploadResults.duplicates).map(([sku, info]) => (
                        <div key={sku} className="bg-white rounded p-3 border border-yellow-200">
                          <p className="font-medium text-gray-900">{sku}</p>
                          <p className="text-sm text-gray-600">
                            {info.count} entries consolidated: {info.quantities.join(' + ')} = {info.quantities.reduce((a, b) => a + b, 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Success Details */}
              {uploadResults.success && uploadResults.success.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h4 className="text-lg font-semibold text-gray-900">Successfully Updated Products ({uploadResults.processed})</h4>
                  </div>
                  <div className="bg-green-50 rounded-lg border border-green-200">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="min-w-full">
                        <thead className="bg-green-100 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-green-800 uppercase tracking-wider">SKU</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-green-800 uppercase tracking-wider">Quantity Removed</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-green-800 uppercase tracking-wider">Stock Movement</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-green-200">
                          {uploadResults.success.map((item: string, index: number) => {
                            const parts = item.split(': ')
                            const sku = parts[0]
                            const details = parts[1] || ''
                            const quantityMatch = details.match(/-(\d+)/)
                            const movementMatch = details.match(/\((\d+) → (\d+)\)/)
                            
                            return (
                              <tr key={index} className="hover:bg-green-75">
                                <td className="px-4 py-2 text-sm font-medium text-green-900">{sku}</td>
                                <td className="px-4 py-2 text-sm text-green-800">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    -{quantityMatch ? quantityMatch[1] : 'N/A'}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm text-green-800">
                                  {movementMatch ? `${movementMatch[1]} → ${movementMatch[2]}` : details}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Details */}
              {uploadResults.errors && uploadResults.errors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <h4 className="text-lg font-semibold text-gray-900">Errors Encountered ({uploadResults.errors.length})</h4>
                  </div>
                  <div className="bg-red-50 rounded-lg border border-red-200">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="min-w-full">
                        <thead className="bg-red-100 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase tracking-wider">SKU/Issue</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Error Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-200">
                          {uploadResults.errors.map((error: string, index: number) => {
                            const parts = error.split(': ')
                            const sku = parts[0] || 'Unknown'
                            const description = parts[1] || error
                            
                            return (
                              <tr key={index} className="hover:bg-red-75">
                                <td className="px-4 py-2 text-sm font-medium text-red-900">{sku}</td>
                                <td className="px-4 py-2 text-sm text-red-800">{description}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* No Results */}
              {uploadResults.processed === 0 && uploadResults.errors.length === 0 && (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-gray-500">No data was processed from the uploaded file.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stock Logs */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Stock-Out Activity</h2>
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
              <TrendingDown className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">No stock-out activity yet. Upload a CSV to get started.</p>
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
                      Stock Change
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stockLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{log.product_name || 'Unknown Product'}</div>
                        {log.notes && (
                          <div className="text-xs text-gray-500 mt-1">{log.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{log.sku}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            -{log.quantity}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({log.previous_quantity} → {log.new_quantity})
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{log.user_name || 'System'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString()}
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
    </ProtectedRoute>
  )
}

