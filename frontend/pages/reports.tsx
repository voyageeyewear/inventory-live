import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { 
  FileText, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Package,
  Store,
  Activity,
  BarChart3,
  PieChart,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface DailyMovement {
  _id: string;
  movements: Array<{
    action: string;
    count: number;
    totalQuantityChange: number;
    totalQuantityIn: number;
    totalQuantityOut: number;
  }>;
  totalIn: number;
  totalOut: number;
  totalOperations: number;
}

interface StoreSyncData {
  _id: string;
  syncStats: Array<{
    action: string;
    count: number;
    totalQuantityChanged: number;
    avgSyncDuration: number;
  }>;
  totalSyncs: number;
  totalQuantityChanged: number;
}

interface InventorySummary {
  totalProducts: number;
  totalQuantity: number;
  avgQuantity: number;
  maxQuantity: number;
  minQuantity: number;
  productsNeedingSync: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}

interface ProductActivity {
  _id: string;
  product_name: string;
  totalOperations: number;
  totalQuantityIn: number;
  totalQuantityOut: number;
  netQuantityChange: number;
  lastActivity: string;
}

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Data states
  const [dailyMovements, setDailyMovements] = useState<DailyMovement[]>([]);
  const [storeSyncData, setStoreSyncData] = useState<StoreSyncData[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [productActivity, setProductActivity] = useState<ProductActivity[]>([]);
  const [syncPerformance, setSyncPerformance] = useState<any[]>([]);
  const [errorAnalysis, setErrorAnalysis] = useState<any[]>([]);
  const [auditReports, setAuditReports] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [productAuditData, setProductAuditData] = useState<any>(null);

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      const [
        dailyMovementsRes,
        storeSyncRes,
        inventorySummaryRes,
        productActivityRes,
        syncPerformanceRes
      ] = await Promise.all([
        axios.get(`/api/reports/daily-movements?${params}`),
        axios.get(`/api/reports/store-sync?${params}`),
        axios.get('/api/reports/inventory-summary'),
        axios.get(`/api/reports/product-activity?${params}&limit=20`),
        axios.get(`/api/reports/sync-performance?${params}`)
      ]);

      setDailyMovements(dailyMovementsRes.data.data.dailyMovements || []);
      setStoreSyncData(storeSyncRes.data.data.storeSyncData || []);
      setInventorySummary(inventorySummaryRes.data.data.summary || null);
      setProductActivity(productActivityRes.data.data.productActivity || []);
      setSyncPerformance(syncPerformanceRes.data.data.syncPerformance || []);
      setErrorAnalysis(syncPerformanceRes.data.data.errorAnalysis || []);

    } catch (error: any) {
      toast.error('Failed to fetch reports data');
      console.error('Reports fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, [dateRange]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditReports();
    }
  }, [activeTab]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const fetchAuditReports = async () => {
    try {
      // Fetch all products for audit selection
      const productsResponse = await axios.get('/api/products');
      setAuditReports(productsResponse.data.slice(0, 50)); // Limit to 50 products for performance
    } catch (error) {
      console.error('Failed to fetch audit reports:', error);
    }
  };

  const fetchProductAudit = async (productId: string, sku: string) => {
    try {
      const response = await axios.post('/api/products/audit', {
        productId: parseInt(productId),
        sku: sku
      });
      if (response.data.success) {
        setProductAuditData(response.data.audit);
      }
    } catch (error) {
      console.error('Failed to fetch product audit:', error);
      toast.error('Failed to fetch product audit');
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'daily', name: 'Daily Movements', icon: Calendar },
    { id: 'stores', name: 'Store Performance', icon: Store },
    { id: 'products', name: 'Product Activity', icon: Package },
    { id: 'sync', name: 'Sync Performance', icon: Activity },
    { id: 'audit', name: 'Audit Reports', icon: FileText }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="h-8 w-8 text-blue-600" />
              Reports & Analytics
            </h1>
            <p className="text-gray-600 mt-1">Comprehensive inventory and sync analytics</p>
          </div>
          
          {/* Date Range Filter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <button
              onClick={fetchReportsData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading reports...</span>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && inventorySummary && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center">
                      <Package className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Products</p>
                        <p className="text-2xl font-bold text-gray-900">{formatNumber(inventorySummary.totalProducts)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center">
                      <TrendingUp className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                        <p className="text-2xl font-bold text-gray-900">{formatNumber(inventorySummary.totalQuantity)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center">
                      <AlertTriangle className="h-8 w-8 text-orange-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Need Syncing</p>
                        <p className="text-2xl font-bold text-gray-900">{formatNumber(inventorySummary.productsNeedingSync)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow border">
                    <div className="flex items-center">
                      <TrendingDown className="h-8 w-8 text-red-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Low Stock</p>
                        <p className="text-2xl font-bold text-gray-900">{formatNumber(inventorySummary.lowStockProducts)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow border">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Stats</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Average Quantity:</span>
                        <span className="font-medium">{Math.round(inventorySummary.avgQuantity)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Highest Stock:</span>
                        <span className="font-medium">{formatNumber(inventorySummary.maxQuantity)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Lowest Stock:</span>
                        <span className="font-medium">{formatNumber(inventorySummary.minQuantity)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Out of Stock:</span>
                        <span className="font-medium text-red-600">{formatNumber(inventorySummary.outOfStockProducts)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow border">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Daily Movements:</span>
                        <span className="font-medium">{dailyMovements.reduce((sum, day) => sum + day.totalOperations, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Store Syncs:</span>
                        <span className="font-medium">{storeSyncData.reduce((sum, store) => sum + store.totalSyncs, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Active Products:</span>
                        <span className="font-medium">{productActivity.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Movements Tab */}
            {activeTab === 'daily' && (
              <div className="bg-white rounded-lg shadow border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Daily Stock Movements</h3>
                  <p className="text-sm text-gray-600">Day-wise breakdown of stock in/out operations</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Operations</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock In</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Out</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Change</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dailyMovements.map((day) => (
                        <tr key={day._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatDate(day._id)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(day.totalOperations)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            +{formatNumber(day.totalIn)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            -{formatNumber(day.totalOut)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className={day.totalIn - day.totalOut >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {day.totalIn - day.totalOut >= 0 ? '+' : ''}{formatNumber(day.totalIn - day.totalOut)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Store Performance Tab */}
            {activeTab === 'stores' && (
              <div className="bg-white rounded-lg shadow border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Store Sync Performance</h3>
                  <p className="text-sm text-gray-600">Sync statistics by store</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Syncs</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity Changed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {storeSyncData.map((store) => {
                        const successCount = store.syncStats.find(s => s.action === 'sync_success')?.count || 0;
                        const failureCount = store.syncStats.find(s => s.action === 'sync_failed')?.count || 0;
                        const successRate = store.totalSyncs > 0 ? (successCount / store.totalSyncs * 100) : 0;
                        
                        return (
                          <tr key={store._id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {store._id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatNumber(store.totalSyncs)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatNumber(store.totalQuantityChanged)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                successRate >= 90 ? 'bg-green-100 text-green-800' :
                                successRate >= 70 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {successRate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Product Activity Tab */}
            {activeTab === 'products' && (
              <div className="bg-white rounded-lg shadow border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Most Active Products</h3>
                  <p className="text-sm text-gray-600">Products with the most inventory activity</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Operations</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Out</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Change</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {productActivity.map((product) => (
                        <tr key={product._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                              <div className="text-sm text-gray-500">SKU: {product._id}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(product.totalOperations)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            +{formatNumber(product.totalQuantityIn)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            -{formatNumber(product.totalQuantityOut)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className={product.netQuantityChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {product.netQuantityChange >= 0 ? '+' : ''}{formatNumber(product.netQuantityChange)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(product.lastActivity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sync Performance Tab */}
            {activeTab === 'sync' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow border">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Sync Performance Over Time</h3>
                    <p className="text-sm text-gray-600">Daily sync operations and success rates</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sync Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Failed</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Duration</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {syncPerformance.map((perf, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatDate(perf._id.date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                perf._id.sync_type === 'full_sync' ? 'bg-blue-100 text-blue-800' :
                                perf._id.sync_type === 'single_sync' ? 'bg-green-100 text-green-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {perf._id.sync_type?.replace('_', ' ') || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatNumber(perf.count)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                              {formatNumber(perf.successCount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                              {formatNumber(perf.failureCount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {Math.round(perf.avgDuration)}ms
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Error Analysis */}
                {errorAnalysis.length > 0 && (
                  <div className="bg-white rounded-lg shadow border">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900">Common Sync Errors</h3>
                      <p className="text-sm text-gray-600">Most frequent sync failure reasons</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error Message</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Occurrences</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Affected Stores</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {errorAnalysis.map((error, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                                <div className="truncate" title={error._id}>
                                  {error._id}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatNumber(error.count)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {error.affectedStores.join(', ')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Audit Reports Tab */}
            {activeTab === 'audit' && (
              <div className="space-y-6">
                {/* Product Selection */}
                <div className="bg-white rounded-lg shadow border p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Product-wise Audit Reports</h3>
                  <p className="text-sm text-gray-600 mb-4">Select a product to view detailed audit history with timestamps and changes</p>
                  
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Product
                      </label>
                      <select
                        value={selectedProduct}
                        onChange={(e) => setSelectedProduct(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Choose a product...</option>
                        {auditReports.map((product: any) => (
                          <option key={product.id} value={`${product.id}|${product.sku}`}>
                            {product.product_name} ({product.sku}) - {product.quantity} units
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => {
                        if (selectedProduct) {
                          const [productId, sku] = selectedProduct.split('|');
                          fetchProductAudit(productId, sku);
                        }
                      }}
                      disabled={!selectedProduct}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Generate Report
                    </button>
                  </div>
                </div>

                {/* Audit Report Display */}
                {productAuditData && (
                  <div className="bg-white rounded-lg shadow border">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            Audit Report: {productAuditData.product.product_name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            SKU: {productAuditData.product.sku} | Current Stock: {productAuditData.product.current_quantity} units
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const reportData = {
                              product: productAuditData.product,
                              summary: productAuditData.summary,
                              changes: productAuditData.changes_timeline,
                              generated_at: new Date().toISOString()
                            };
                            console.log('Audit Report Export:', reportData);
                            toast.success('Report exported to console');
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                          <Download className="h-4 w-4" />
                          Export
                        </button>
                      </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="p-6 border-b border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="text-sm font-medium text-blue-600">Total Changes</div>
                          <div className="text-2xl font-bold text-blue-900">{productAuditData.summary.total_changes}</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="text-sm font-medium text-green-600">Stock Operations</div>
                          <div className="text-2xl font-bold text-green-900">{productAuditData.summary.total_stock_changes}</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <div className="text-sm font-medium text-purple-600">Barcode Scans</div>
                          <div className="text-2xl font-bold text-purple-900">{productAuditData.summary.total_scans}</div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <div className="text-sm font-medium text-orange-600">Net Change</div>
                          <div className="text-2xl font-bold text-orange-900">
                            {productAuditData.summary.quantity_trend.net_change > 0 ? '+' : ''}
                            {productAuditData.summary.quantity_trend.net_change}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Timeline */}
                    <div className="p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">📋 Complete Change History</h4>
                      {productAuditData.changes_timeline.length > 0 ? (
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {productAuditData.changes_timeline.map((change: any, index: number) => (
                            <div key={change.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="text-base font-semibold text-gray-900">{change.change_type}</h5>
                                  <div className="text-right">
                                    <div className="text-sm font-medium text-gray-900">{change.formatted_date}</div>
                                    <div className="text-xs text-gray-500">
                                      {new Date(change.timestamp).toLocaleTimeString()}
                                    </div>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-700 mb-2">{change.description}</p>
                                {change.notes && (
                                  <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
                                    <p className="text-xs text-yellow-800">
                                      <strong>Notes:</strong> {change.notes}
                                    </p>
                                  </div>
                                )}
                                <div className="flex items-center gap-6 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    👤 <strong>Performed by:</strong> {change.performed_by}
                                  </span>
                                  {change.user_email && (
                                    <span className="flex items-center gap-1">
                                      📧 {change.user_email}
                                    </span>
                                  )}
                                  {change.previous_quantity !== null && change.new_quantity !== null && (
                                    <span className="flex items-center gap-1">
                                      📊 <strong>Change:</strong> {change.previous_quantity} → {change.new_quantity} units
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                          <p>No audit history available for this product</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
