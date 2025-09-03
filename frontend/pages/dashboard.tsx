import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Store, 
  AlertTriangle,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import UserDashboard from '../components/UserDashboard';

interface DashboardData {
  overview: {
    totalProducts: number;
    totalStores: number;
    connectedStores: number;
    todaySync: number;
    todayStock: number;
  };
  syncStats: {
    sync_success?: number;
    sync_failed?: number;
    sync_skipped?: number;
  };
  stockStats: {
    stock_in?: { count: number; totalChange: number };
    stock_out?: { count: number; totalChange: number };
    stock_update?: { count: number; totalChange: number };
  };
  recentActivity: {
    sync: Array<{
      _id: string;
      sku: string;
      product_name: string;
      action: string;
      store_name: string;
      new_quantity: number;
      createdAt: string;
    }>;
    stock: Array<{
      _id: string;
      sku: string;
      product_name: string;
      action: string;
      old_quantity: number;
      new_quantity: number;
      quantity_change: number;
      createdAt: string;
    }>;
  };
  lowStockProducts: Array<{
    _id: string;
    sku: string;
    product_name: string;
    quantity: number;
  }>;
  dailyActivity: Array<{
    _id: { date: string; action: string };
    count: number;
  }>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, hasPermission } = useAuth();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/audit/dashboard');
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError('Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
            className="mt-2 btn-secondary"
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

  const getActionColor = (action: string) => {
    switch (action) {
      case 'sync_success': return 'text-green-600';
      case 'sync_failed': return 'text-red-600';
      case 'stock_in': return 'text-blue-600';
      case 'stock_out': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'sync_success': return <CheckCircle className="h-4 w-4" />;
      case 'sync_failed': return <XCircle className="h-4 w-4" />;
      case 'stock_in': return <TrendingUp className="h-4 w-4" />;
      case 'stock_out': return <TrendingDown className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  // Show user-specific dashboard for non-admin users
  if (user?.role === 'user') {
    return (
      <ProtectedRoute requiredPermission="viewDashboard">
        <Layout>
          <UserDashboard />
        </Layout>
      </ProtectedRoute>
    );
  }

  // Show admin/manager dashboard
  return (
    <ProtectedRoute requiredPermission="viewDashboard">
      <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Overview of your inventory management system</p>
          </div>
          <button 
            onClick={fetchDashboardData}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{data.overview.totalProducts.toLocaleString()}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Connected Stores</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.overview.connectedStores}/{data.overview.totalStores}
                </p>
              </div>
              <Store className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Syncs</p>
                <p className="text-2xl font-bold text-gray-900">{data.overview.todaySync}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Stock Changes</p>
                <p className="text-2xl font-bold text-gray-900">{data.overview.todayStock}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                <p className="text-2xl font-bold text-gray-900">{data.lowStockProducts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Sync Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync Statistics (Last 7 Days)</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-gray-700">Successful Syncs</span>
                </div>
                <span className="font-semibold text-green-600">
                  {data.syncStats.sync_success || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-gray-700">Failed Syncs</span>
                </div>
                <span className="font-semibold text-red-600">
                  {data.syncStats.sync_failed || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-700">Skipped Syncs</span>
                </div>
                <span className="font-semibold text-gray-600">
                  {data.syncStats.sync_skipped || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Movement (Last 7 Days)</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700">Stock In</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-blue-600">
                    {data.stockStats.stock_in?.count || 0} operations
                  </div>
                  <div className="text-sm text-gray-500">
                    +{data.stockStats.stock_in?.totalChange || 0} units
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                  <span className="text-gray-700">Stock Out</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-orange-600">
                    {data.stockStats.stock_out?.count || 0} operations
                  </div>
                  <div className="text-sm text-gray-500">
                    {data.stockStats.stock_out?.totalChange || 0} units
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity and Low Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Sync Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sync Activity</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.recentActivity.sync.length > 0 ? (
                data.recentActivity.sync.map((item) => (
                  <div key={item._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className={getActionColor(item.action)}>
                        {getActionIcon(item.action)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.sku}</p>
                        <p className="text-xs text-gray-500 truncate max-w-48">{item.product_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{item.store_name}</p>
                      <p className="text-xs text-gray-500">{formatDate(item.createdAt)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No recent sync activity</p>
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
                  <div key={product._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{product.sku}</p>
                      <p className="text-xs text-gray-500 truncate max-w-48">{product.product_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.quantity === 0 
                          ? 'bg-red-100 text-red-800' 
                          : product.quantity < 5 
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {product.quantity} units
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No low stock items</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Stock Activity */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Stock Activity</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.recentActivity.stock.length > 0 ? (
                  data.recentActivity.stock.map((item) => (
                    <tr key={item._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.sku}</div>
                          <div className="text-sm text-gray-500 truncate max-w-48">{item.product_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center gap-2 ${getActionColor(item.action)}`}>
                          {getActionIcon(item.action)}
                          <span className="text-sm capitalize">{item.action.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          item.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.quantity_change > 0 ? '+' : ''}{item.quantity_change}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.new_quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(item.createdAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No recent stock activity
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
