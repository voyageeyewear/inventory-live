import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Package, 
  User, 
  Calendar,
  ArrowUp,
  ArrowDown,
  Smartphone,
  AlertCircle
} from 'lucide-react'

interface MobileTransaction {
  id: number
  product_id: number
  sku: string
  transaction_type: string
  quantity: number
  notes: string
  current_stock: number
  status: string
  requested_by_user_id: number
  requested_by_username: string
  created_at: string
  product_name: string
  image_url: string
  category: string
}

export default function MobileApprovals() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<MobileTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)

  useEffect(() => {
    fetchPendingTransactions()
  }, [])

  const fetchPendingTransactions = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/mobile-transactions')
      setTransactions(response.data.data)
    } catch (error: any) {
      console.error('Fetch transactions error:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch pending transactions')
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (transactionId: number, action: 'approve' | 'reject') => {
    try {
      setProcessingId(transactionId)
      const response = await axios.post('/api/mobile-transactions/approve', {
        transactionId,
        action
      })

      if (response.data.success) {
        toast.success(response.data.message)
        // Remove the processed transaction from the list
        setTransactions(prev => prev.filter(t => t.id !== transactionId))
      }
    } catch (error: any) {
      console.error('Approval error:', error)
      toast.error(error.response?.data?.message || `Failed to ${action} transaction`)
    } finally {
      setProcessingId(null)
    }
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

  const getTransactionIcon = (type: string) => {
    return type === 'stock_in' ? (
      <ArrowUp className="h-5 w-5 text-green-600" />
    ) : (
      <ArrowDown className="h-5 w-5 text-red-600" />
    )
  }

  const getTransactionColor = (type: string) => {
    return type === 'stock_in' ? 'text-green-600' : 'text-red-600'
  }

  const getNewStock = (transaction: MobileTransaction) => {
    if (transaction.transaction_type === 'stock_in') {
      return transaction.current_stock + transaction.quantity
    } else {
      return transaction.current_stock - transaction.quantity
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <ProtectedRoute requiredPermission="manageStores">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Smartphone className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Mobile Approvals</h1>
                  <p className="text-gray-600">Review and approve mobile app stock transactions</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  {transactions.length} Pending
                </span>
              </div>
            </div>
          </div>

          {/* Transactions List */}
          {transactions.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
              <p className="text-gray-600">No pending mobile transactions to review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      {/* Transaction Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          {getTransactionIcon(transaction.transaction_type)}
                          <h3 className="text-lg font-semibold text-gray-900">
                            {transaction.product_name}
                          </h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTransactionColor(transaction.transaction_type)} bg-opacity-10`}>
                            {transaction.transaction_type.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">SKU: {transaction.sku}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">By: {transaction.requested_by_username}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{formatDate(transaction.created_at)}</span>
                          </div>
                        </div>

                        {/* Stock Changes */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-sm text-gray-600">Current Stock</p>
                              <p className="text-lg font-semibold text-gray-900">{transaction.current_stock}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">
                                {transaction.transaction_type === 'stock_in' ? 'Adding' : 'Removing'}
                              </p>
                              <p className={`text-lg font-semibold ${getTransactionColor(transaction.transaction_type)}`}>
                                {transaction.transaction_type === 'stock_in' ? '+' : '-'}{transaction.quantity}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">New Stock</p>
                              <p className="text-lg font-semibold text-blue-600">{getNewStock(transaction)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        {transaction.notes && (
                          <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-1">Notes:</p>
                            <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded">{transaction.notes}</p>
                          </div>
                        )}

                        {/* Warning for stock out */}
                        {transaction.transaction_type === 'stock_out' && transaction.quantity > transaction.current_stock && (
                          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span className="text-sm text-red-800">
                              Warning: Insufficient stock for this transaction
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Product Image */}
                      <div className="ml-6">
                        {transaction.image_url ? (
                          <img
                            src={transaction.image_url}
                            alt={transaction.product_name}
                            className="w-20 h-20 object-cover rounded-lg"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAzMkM0NC40IDMyIDQ4IDM1LjYgNDggNTZDNDggNzYuNCA0NC40IDgwIDI0IDgwQzMuNiA4MCAyIDc2LjQgMiA1NkMyIDM1LjYgNS42IDMyIDI0IDMyWiIgZmlsbD0iI0U1RTdFQiIvPgo8L3N2Zz4K'
                            }}
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                            <Package className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handleApproval(transaction.id, 'reject')}
                        disabled={processingId === transaction.id}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircle className="h-4 w-4" />
                        {processingId === transaction.id ? 'Processing...' : 'Reject'}
                      </button>
                      <button
                        onClick={() => handleApproval(transaction.id, 'approve')}
                        disabled={processingId === transaction.id}
                        className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {processingId === transaction.id ? 'Processing...' : 'Approve'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
