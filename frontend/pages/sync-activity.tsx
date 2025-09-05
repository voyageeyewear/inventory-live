import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  Filter,
  Calendar,
  Package,
  Search,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface SyncLog {
  _id: string;
  sku: string;
  product_name: string;
  store_name: string;
  store_domain: string;
  action: 'sync_success' | 'sync_failed' | 'sync_skipped';
  old_quantity: number | null;
  new_quantity: number;
  quantity_change: number;
  error_message?: string;
  sync_type: 'full_sync' | 'single_sync' | 'multi_sync';
  shopify_product_id?: string;
  shopify_variant_id?: string;
  sync_duration_ms: number;
  createdAt: string;
}

interface SyncActivityData {
  logs: SyncLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function SyncActivity() {
  const [data, setData] = useState<SyncActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [filters, setFilters] = useState({
    sku: '',
    store: '',
    action: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 50
  });

  const [showFilters, setShowFilters] = useState(false);
  const [stores, setStores] = useState<any[]>([]);

  const fetchSyncLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.sku) params.append('sku', filters.sku);
      if (filters.store) params.append('store', filters.store);
      if (filters.action) params.append('action', filters.action);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const response = await axios.get(`/api/audit/sync?${params.toString()}`);
      
      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch sync logs');
      }
    } catch (err: any) {
      setError('Failed to fetch sync logs');
      console.error('Sync logs fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await axios.get('/api/stores');
      setStores(response.data);
    } catch (err) {
      console.error('Failed to fetch stores:', err);
    }
  };

  useEffect(() => {
    fetchSyncLogs();
    fetchStores();
  }, [filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filtering
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const clearFilters = () => {
    setFilters({
      sku: '',
      store: '',
      action: '',
      startDate: '',
      endDate: '',
      page: 1,
      limit: 50
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'sync_success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'sync_failed': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'sync_skipped': return <Clock className="h-4 w-4 text-yellow-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'sync_success': return 'text-green-600 bg-green-50';
      case 'sync_failed': return 'text-red-600 bg-red-50';
      case 'sync_skipped': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSyncTypeLabel = (syncType: string) => {
    switch (syncType) {
      case 'full_sync': return 'Full Sync';
      case 'single_sync': return 'Single Product';
      case 'multi_sync': return 'Multi Product';
      default: return syncType;
    }
  };

  const getSyncTypeBadge = (syncType: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (syncType) {
      case 'full_sync': return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'single_sync': return `${baseClasses} bg-purple-100 text-purple-800`;
      case 'multi_sync': return `${baseClasses} bg-indigo-100 text-indigo-800`;
      default: return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  if (loading && !data) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Loading sync activity...</span>
        </div>
      </Layout>
    );
  }

  if (error && !data) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
          <button 
            onClick={fetchSyncLogs}
            className="mt-2 btn-secondary"
          >
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sync Activity</h1>
            <p className="text-gray-600 mt-1">Complete history of all sync operations</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button 
              onClick={fetchSyncLogs}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter Sync Activity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* SKU Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search SKU..."
                    value={filters.sku}
                    onChange={(e) => handleFilterChange('sku', e.target.value)}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Store Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                <select
                  value={filters.store}
                  onChange={(e) => handleFilterChange('store', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Stores</option>
                  {stores.map((store) => (
                    <option key={store._id} value={store.store_domain}>
                      {store.store_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="sync_success">Success</option>
                  <option value="sync_failed">Failed</option>
                  <option value="sync_skipped">Skipped</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={clearFilters}
                className="btn-secondary text-sm"
              >
                Clear Filters
              </button>
              <span className="text-sm text-gray-500">
                {data?.pagination.total || 0} total records
              </span>
            </div>
          </div>
        )}

        {/* Sync Activity Table */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Sync History</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Activity className="h-4 w-4" />
                {data?.logs.length || 0} records
              </div>
            </div>
          </div>

          {data?.logs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">No sync activity found</p>
              <p className="text-sm text-gray-400">Try adjusting your filters or sync some products</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Store
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity Change
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data?.logs.map((log) => (
                      <tr key={log._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getActionColor(log.action)}`}>
                            {getActionIcon(log.action)}
                            <span className="capitalize">
                              {log.action?.replace('sync_', '') || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900 font-mono">
                              {log.sku}
                            </div>
                            <div className="text-sm text-gray-500 max-w-xs truncate">
                              {log.product_name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{log.store_name}</div>
                          <div className="text-sm text-gray-500">{log.store_domain}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={getSyncTypeBadge(log.sync_type)}>
                            {getSyncTypeLabel(log.sync_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            {log.old_quantity !== null ? (
                              <div className="text-sm text-gray-900">
                                <span className="text-gray-500 font-mono">{log.old_quantity}</span>
                                <span className="mx-2 text-gray-400">→</span>
                                <span className="font-medium font-mono">{log.new_quantity}</span>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-900">
                                <span className="font-medium font-mono">{log.new_quantity}</span>
                                <span className="text-xs text-gray-500 ml-1">(new)</span>
                              </div>
                            )}
                            {log.quantity_change !== 0 && (
                              <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                log.quantity_change > 0 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {log.quantity_change > 0 ? '+' : ''}{log.quantity_change} units
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDuration(log.sync_duration_ms)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {log.error_message ? (
                            <div className="text-red-600 max-w-xs truncate" title={log.error_message}>
                              {log.error_message}
                            </div>
                          ) : (
                            <div className="text-gray-400">-</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data && data.pagination.pages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to{' '}
                      {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{' '}
                      {data.pagination.total} results
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(data.pagination.page - 1)}
                        disabled={data.pagination.page === 1}
                        className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </button>
                      <span className="text-sm text-gray-700">
                        Page {data.pagination.page} of {data.pagination.pages}
                      </span>
                      <button
                        onClick={() => handlePageChange(data.pagination.page + 1)}
                        disabled={data.pagination.page === data.pagination.pages}
                        className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
