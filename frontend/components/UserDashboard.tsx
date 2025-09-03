import { useState, useEffect } from 'react';
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Activity,
  RefreshCw,
  BarChart3,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  User
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface UserDashboardData {
  user: {
    username: string;
    role: string;
  };
  summary: {
    totalActivities: number;
    totalSyncs: number;
    todayActivities: number;
    productsAdded: number;
    totalStockIn: number;
    totalStockOut: number;
    productsNeedingSync: number;
  };
  recentActivities: {
    stockMovements: any[];
    syncActivities: any[];
    activityByDate: any;
  };
  charts: {
    last7DaysActivity: any[];
  };
  alerts: Array<{
    type: string;
    message: string;
    action: string;
  }>;
}

export default function UserDashboard() {
  const [dashboardData, setDashboardData] = useState<UserDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchUserDashboard = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/audit/user-dashboard');
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching user dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading your dashboard...</span>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">Failed to load dashboard data</p>
        <button 
          onClick={fetchUserDashboard}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, recentActivities, alerts } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3">
          <User className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.firstName}!</h1>
            <p className="text-blue-100">Here's your inventory activity overview</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <div 
              key={index}
              className={`p-4 rounded-lg border-l-4 ${
                alert.type === 'warning' 
                  ? 'bg-yellow-50 border-yellow-400 text-yellow-800' 
                  : 'bg-blue-50 border-blue-400 text-blue-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">{alert.message}</span>
                </div>
                <button className="text-sm underline hover:no-underline">
                  {alert.action}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Activities</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalActivities}</p>
            </div>
            <Activity className="h-8 w-8 text-blue-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">All time</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Activities</p>
              <p className="text-2xl font-bold text-gray-900">{summary.todayActivities}</p>
            </div>
            <Calendar className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">Since midnight</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Added</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalStockIn.toLocaleString()}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">Total units</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Removed</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalStockOut.toLocaleString()}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">Total units</p>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Stock Movements */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Recent Stock Movements
            </h3>
          </div>
          <div className="p-6">
            {recentActivities.stockMovements.length > 0 ? (
              <div className="space-y-4">
                {recentActivities.stockMovements.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {activity.action === 'stock_in' ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : activity.action === 'stock_out' ? (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      ) : (
                        <Package className="h-4 w-4 text-blue-600" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{activity.sku}</p>
                        <p className="text-xs text-gray-500">{activity.product_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium text-sm ${
                        activity.action === 'stock_in' ? 'text-green-600' : 
                        activity.action === 'stock_out' ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {activity.action === 'stock_in' ? '+' : activity.action === 'stock_out' ? '-' : ''}
                        {Math.abs(activity.quantity_change)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No recent stock movements</p>
                <p className="text-sm">Start by adding or removing stock</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Quick Actions
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4">
              <a
                href="/add-product"
                className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Plus className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Add New Product</p>
                  <p className="text-sm text-blue-600">Create a new inventory item</p>
                </div>
              </a>

              <a
                href="/stock-in"
                className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                <TrendingUp className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Stock In</p>
                  <p className="text-sm text-green-600">Add inventory to products</p>
                </div>
              </a>

              <a
                href="/stock-out"
                className="flex items-center gap-3 p-4 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <TrendingDown className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">Stock Out</p>
                  <p className="text-sm text-red-600">Remove inventory from products</p>
                </div>
              </a>

              <a
                href="/"
                className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Eye className="h-6 w-6 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">View Products</p>
                  <p className="text-sm text-gray-600">Browse all inventory items</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Your Performance Summary
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{summary.productsAdded}</div>
              <div className="text-sm text-gray-600">Products Added (30 days)</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{summary.totalSyncs}</div>
              <div className="text-sm text-gray-600">Sync Operations</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{summary.totalActivities}</div>
              <div className="text-sm text-gray-600">Total Activities</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
