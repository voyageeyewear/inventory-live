import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Users, 
  Store, 
  AlertTriangle,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Calendar,
  Filter,
  Download,
  Eye,
  FileText,
  Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import UserDashboard from '../components/UserDashboard';
import axios from 'axios';

interface DashboardData {
  overview: {
    totalProducts: number;
    totalStores: number;
    connectedStores: number;
    todaysSyncs: number;
    todaysStockChanges: number;
    lowStockItems: number;
    totalInventoryValue: number;
  };
  syncStats: {
    syncSuccess: number;
    syncFailed: number;
    syncSkipped: number;
    totalSyncs: number;
  };
  stockStats: {
    stockIn: { count: number; totalChange: number };
    stockOut: { count: number; totalChange: number };
    adjustments: { count: number };
  };
  csvStats: {
    totalCsvUploads: number;
    consolidatedUploads: number;
    uniqueCsvFiles: number;
  };
  charts: {
    dailyActivity: Array<{
      date: string;
      total: number;
      syncs: number;
      stockIn: number;
      stockOut: number;
      scans: number;
    }>;
    hourlyActivity: Array<{
      hour: number;
      activities: number;
      syncs: number;
      stockChanges: number;
    }>;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    quantity: number;
    notes: string;
    user_name: string;
    created_at: string;
    sku: string;
    product_name: string;
    current_quantity: number;
  }>;
  lowStockProducts: Array<{
    id: string;
    sku: string;
    product_name: string;
    quantity: number;
    price: number;
    category: string;
    stock_status: string;
  }>;
  topCategories: Array<{
    category: string;
    activityCount: number;
    stockInCount: number;
    stockOutCount: number;
    syncCount: number;
  }>;
  userActivity: Array<{
    userName: string;
    totalActivities: number;
    syncActivities: number;
    stockInActivities: number;
    stockOutActivities: number;
    lastActivity: string;
  }>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedDateRange, setSelectedDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [showFilters, setShowFilters] = useState(false);
  const { user, hasPermission, token, isFullyAuthenticated } = useAuth();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        period: selectedPeriod,
        startDate: selectedDateRange.startDate,
        endDate: selectedDateRange.endDate
      });

      const response = await axios.get(`/api/dashboard/analytics?${params}`);
      
      if (response.data.success) {
        setData(response.data.data);
        setError('');
      } else {
        throw new Error(response.data.message || 'Failed to fetch dashboard data');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFullyAuthenticated) {
      console.log('Dashboard: Making API call - fully authenticated');
      fetchDashboardData();
    }
  }, [isFullyAuthenticated, selectedPeriod, selectedDateRange]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Loading dashboard...</span>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
          <button 
            onClick={fetchDashboardData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  if (!data) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'sync': return 'text-blue-600';
      case 'stock_in':
      case 'bulk_in': return 'text-green-600';
      case 'stock_out':
      case 'bulk_out': return 'text-red-600';
      case 'adjustment': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'sync': return <RefreshCw className="h-4 w-4" />;
      case 'stock_in':
      case 'bulk_in': return <TrendingUp className="h-4 w-4" />;
      case 'stock_out':
      case 'bulk_out': return <TrendingDown className="h-4 w-4" />;
      case 'adjustment': return <BarChart3 className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'sync': return 'Sync';
      case 'stock_in': return 'Stock In';
      case 'bulk_in': return 'Bulk Stock In';
      case 'stock_out': return 'Stock Out';
      case 'bulk_out': return 'Bulk Stock Out';
      case 'adjustment': return 'Adjustment';
      default: return type;
    }
  };

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    setSelectedDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    });
  };

  const exportDashboardData = () => {
    if (!data) return;
    
    const csvContent = [
      ['Metric', 'Value'],
      ['Total Products', data.overview.totalProducts],
      ['Connected Stores', `${data.overview.connectedStores}/${data.overview.totalStores}`],
      ['Today\'s Syncs', data.overview.todaysSyncs],
      ['Stock Changes', data.overview.todaysStockChanges],
      ['Low Stock Items', data.overview.lowStockItems],
      ['Total Inventory Value', formatCurrency(data.overview.totalInventoryValue)],
      ['Sync Success Rate', `${Math.round((data.syncStats.syncSuccess / Math.max(data.syncStats.totalSyncs, 1)) * 100)}%`],
      ['CSV Uploads', data.csvStats.totalCsvUploads],
      ['Consolidated Uploads', data.csvStats.consolidatedUploads]
    ];
    
    const csvString = csvContent.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Show user-specific dashboard for non-admin users
  if (user?.role === 'user') {
    return (
      <ProtectedRoute>
        <Layout>
          <UserDashboard />
        </Layout>
      </ProtectedRoute>
    );
  }

  // Show admin/manager dashboard
  return (
    <ProtectedRoute>
      <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Comprehensive analytics and insights for your inventory management</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button 
              onClick={exportDashboardData}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button 
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Time Period:</span>
              </div>
              <div className="flex gap-2">
                {['7d', '30d', '90d', '1y'].map((period) => (
                  <button
                    key={period}
                    onClick={() => handlePeriodChange(period)}
                    className={`px-3 py-1 text-sm rounded-full ${
                      selectedPeriod === period
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {period === '7d' ? '7 Days' : 
                     period === '30d' ? '30 Days' :
                     period === '90d' ? '90 Days' : '1 Year'}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={selectedDateRange.startDate}
                  onChange={(e) => setSelectedDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={selectedDateRange.endDate}
                  onChange={(e) => setSelectedDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{data.overview.totalProducts.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Active inventory items</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Connected Stores</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.overview.connectedStores}/{data.overview.totalStores}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round((data.overview.connectedStores / Math.max(data.overview.totalStores, 1)) * 100)}% connected
                </p>
              </div>
              <Store className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Period Syncs</p>
                <p className="text-2xl font-bold text-gray-900">{data.overview.todaysSyncs}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {data.syncStats.totalSyncs > 0 ? 
                    `${Math.round((data.syncStats.syncSuccess / data.syncStats.totalSyncs) * 100)}% success rate` :
                    'No syncs in period'
                  }
                </p>
              </div>
              <RefreshCw className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Stock Changes</p>
                <p className="text-2xl font-bold text-gray-900">{data.overview.todaysStockChanges}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {data.stockStats.stockIn.totalChange > 0 ? `+${data.stockStats.stockIn.totalChange}` : 0} in, 
                  {data.stockStats.stockOut.totalChange > 0 ? ` -${data.stockStats.stockOut.totalChange}` : 0} out
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Additional Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inventory Value</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(data.overview.totalInventoryValue)}</p>
                <p className="text-xs text-gray-500 mt-1">Total estimated value</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                <p className="text-2xl font-bold text-red-600">{data.overview.lowStockItems}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {data.overview.lowStockItems > 0 ? 'Need attention' : 'All good'}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">CSV Uploads</p>
                <p className="text-2xl font-bold text-blue-600">{data.csvStats.totalCsvUploads}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {data.csvStats.consolidatedUploads} consolidated
                </p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Activity Chart */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Daily Activity Trend
            </h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {data.charts.dailyActivity.slice(0, 14).reverse().map((day, index) => {
                const maxActivity = Math.max(...data.charts.dailyActivity.map(d => d.total));
                const height = (day.total / Math.max(maxActivity, 1)) * 100;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: `${height}%` }}>
                      <div className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded-t-lg h-full"></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2 text-center">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-xs font-medium text-gray-700">{day.total}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-gray-600">Total Activities</span>
              </div>
            </div>
          </div>

          {/* Sync Success Rate */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              Sync Performance
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-gray-700">Successful Syncs</span>
                </div>
                <span className="font-semibold text-green-600">{data.syncStats.syncSuccess}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-gray-700">Failed Syncs</span>
                </div>
                <span className="font-semibold text-red-600">{data.syncStats.syncFailed}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-700">Skipped Syncs</span>
                </div>
                <span className="font-semibold text-gray-600">{data.syncStats.syncSkipped}</span>
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Success Rate</span>
                  <span className="font-semibold text-blue-600">
                    {data.syncStats.totalSyncs > 0 ? 
                      `${Math.round((data.syncStats.syncSuccess / data.syncStats.totalSyncs) * 100)}%` :
                      '0%'
                    }
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${data.syncStats.totalSyncs > 0 ? 
                        (data.syncStats.syncSuccess / data.syncStats.totalSyncs) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stock Movement Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Stock Movement Summary
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="text-gray-700">Stock In Operations</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-600">
                    {data.stockStats.stockIn.count} operations
                  </div>
                  <div className="text-sm text-gray-500">
                    +{data.stockStats.stockIn.totalChange.toLocaleString()} units
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <span className="text-gray-700">Stock Out Operations</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-red-600">
                    {data.stockStats.stockOut.count} operations
                  </div>
                  <div className="text-sm text-gray-500">
                    -{data.stockStats.stockOut.totalChange.toLocaleString()} units
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-orange-600" />
                  <span className="text-gray-700">Adjustments</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-orange-600">
                    {data.stockStats.adjustments.count} operations
                  </div>
                  <div className="text-sm text-gray-500">
                    Manual corrections
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Categories */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Top Active Categories
            </h3>
            <div className="space-y-3">
              {data.topCategories.slice(0, 5).map((category, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-700 truncate">{category.category || 'Uncategorized'}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">{category.activityCount}</div>
                    <div className="text-xs text-gray-500">
                      {category.stockInCount} in, {category.stockOutCount} out
                    </div>
                  </div>
                </div>
              ))}
              {data.topCategories.length === 0 && (
                <p className="text-gray-500 text-center py-4">No category data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity and Low Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Recent Activity
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.recentActivity.length > 0 ? (
                data.recentActivity.slice(0, 10).map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className={getActionColor(item.type)}>
                        {getActionIcon(item.type)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.sku}</p>
                        <p className="text-xs text-gray-500 truncate max-w-48">{item.product_name}</p>
                        <p className="text-xs text-gray-400">{getActionLabel(item.type)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{item.user_name || 'System'}</p>
                      <p className="text-xs text-gray-500">{formatDate(item.created_at)}</p>
                      {item.quantity && (
                        <p className="text-xs text-gray-400">{item.quantity} units</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No recent activity</p>
              )}
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Low Stock Alert (&lt; 10 units)
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.lowStockProducts.length > 0 ? (
                data.lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{product.sku}</p>
                      <p className="text-xs text-gray-500 truncate max-w-48">{product.product_name}</p>
                      {product.category && (
                        <p className="text-xs text-gray-400">{product.category}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.stock_status === 'critical'
                          ? 'bg-red-100 text-red-800' 
                          : product.stock_status === 'low'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {product.quantity} units
                      </span>
                      {product.price > 0 && (
                        <p className="text-xs text-gray-400 mt-1">{formatCurrency(product.price)}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No low stock items</p>
              )}
            </div>
          </div>
        </div>

        {/* User Activity and Detailed Activity Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              User Activity Summary
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.userActivity.length > 0 ? (
                data.userActivity.map((user, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{user.userName}</p>
                      <p className="text-xs text-gray-500">Last active: {formatDate(user.lastActivity)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{user.totalActivities}</p>
                      <p className="text-xs text-gray-500">
                        {user.syncActivities} sync, {user.stockInActivities + user.stockOutActivities} stock
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No user activity data</p>
              )}
            </div>
          </div>

          {/* CSV Upload Statistics */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              CSV Upload Statistics
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Total CSV Uploads</span>
                <span className="font-semibold text-blue-600">{data.csvStats.totalCsvUploads}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Consolidated Uploads</span>
                <span className="font-semibold text-orange-600">{data.csvStats.consolidatedUploads}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Unique CSV Files</span>
                <span className="font-semibold text-green-600">{data.csvStats.uniqueCsvFiles}</span>
              </div>
              <div className="pt-4 border-t">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Consolidation Rate</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {data.csvStats.totalCsvUploads > 0 ? 
                      `${Math.round((data.csvStats.consolidatedUploads / data.csvStats.totalCsvUploads) * 100)}%` :
                      '0%'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Activity Table */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5 text-purple-600" />
            Detailed Activity Log
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.recentActivity.slice(0, 20).map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.sku}</div>
                        <div className="text-sm text-gray-500 truncate max-w-48">{item.product_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center gap-2 ${getActionColor(item.type)}`}>
                        {getActionIcon(item.type)}
                        <span className="text-sm capitalize">{getActionLabel(item.type)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        item.type.includes('in') ? 'text-green-600' : 
                        item.type.includes('out') ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {item.quantity > 0 ? (item.type.includes('in') ? '+' : '-') : ''}{item.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.current_quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.user_name || 'System'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(item.created_at)}
                    </td>
                  </tr>
                ))}
                {data.recentActivity.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No activity data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
    </ProtectedRoute>
  );
}