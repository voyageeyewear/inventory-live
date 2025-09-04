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
  RefreshCw,
  XCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import UserDashboard from '../components/UserDashboard';
import axios from 'axios';

interface DashboardData {
  stats: {
    totalProducts: number;
    totalUsers: number;
    totalStores: number;
    lowStockCount: number;
  };
  recentActivity: Array<{
    id: number;
    sku: string;
    product_name: string;
    action: string;
    old_quantity: number;
    new_quantity: number;
    quantity_change: number;
    created_at: string;
  }>;
  lowStockProducts: Array<{
    id: number;
    sku: string;
    product_name: string;
    quantity: number;
  }>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, hasPermission, token, isFullyAuthenticated } = useAuth();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/audit/dashboard');
      setData(response.data);
      setError('');
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
  }, [isFullyAuthenticated]);

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

  const getActionColor = (action: string) => {
    switch (action) {
      case 'Stock-In': return 'text-green-600';
      case 'Stock-Out': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'Stock-In': return <TrendingUp className="h-4 w-4" />;
      case 'Stock-Out': return <TrendingDown className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
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
            <p className="text-gray-600 mt-1">Overview of your inventory management system</p>
          </div>
          <button 
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{data.stats.totalProducts.toLocaleString()}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{data.stats.totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Stores</p>
                <p className="text-2xl font-bold text-gray-900">{data.stats.totalStores}</p>
              </div>
              <Store className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                <p className="text-2xl font-bold text-gray-900">{data.stats.lowStockCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Recent Activity and Low Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Stock Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Stock Activity</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.recentActivity.length > 0 ? (
                data.recentActivity.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
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
                      <p className="text-sm font-medium text-gray-900">
                        {item.quantity_change > 0 ? '+' : ''}{item.quantity_change}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(item.created_at)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No recent stock activity</p>
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

        {/* Recent Stock Activity Table */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Stock Activity Details</h3>
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
                {data.recentActivity.length > 0 ? (
                  data.recentActivity.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.sku}</div>
                          <div className="text-sm text-gray-500 truncate max-w-48">{item.product_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center gap-2 ${getActionColor(item.action)}`}>
                          {getActionIcon(item.action)}
                          <span className="text-sm">{item.action}</span>
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
                        {formatDate(item.created_at)}
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