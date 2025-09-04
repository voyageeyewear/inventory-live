import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import toast from 'react-hot-toast';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
  isFullyAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
          
          // Set axios default header
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          console.log('Auth initialized with token:', storedToken.substring(0, 20) + '...');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Clear invalid data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Axios interceptor to handle token expiration
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        console.log('Axios interceptor caught error:', {
          status: error.response?.status,
          url: error.config?.url,
          hasToken: !!token,
          message: error.response?.data?.message
        });
        
        // Only logout on 401 for API routes that should be authenticated
        if (error.response?.status === 401 && token && error.config?.url?.startsWith('/api/')) {
          // Exclude login and setup endpoints from causing logout
          if (!error.config.url.includes('/api/auth/login') && 
              !error.config.url.includes('/api/setup') &&
              !error.config.url.includes('/api/health')) {
            console.log('Logging out due to 401 on authenticated endpoint:', error.config.url);
            logout();
            toast.error('Session expired. Please login again.');
            router.push('/login');
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [token, router]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await axios.post('/api/auth/login', {
        username,
        password
      });

      if (response.data.success) {
        const { user: userData, token: userToken } = response.data;
        
        console.log('Login successful, setting token:', userToken.substring(0, 20) + '...');
        
        setUser(userData);
        setToken(userToken);
        
        // Store in localStorage
        localStorage.setItem('token', userToken);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Set axios default header
        axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
        console.log('Axios headers set:', axios.defaults.headers.common['Authorization']?.substring(0, 30) + '...');
        
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Login error:', error);
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Remove axios default header
    delete axios.defaults.headers.common['Authorization'];
    
    // Redirect to login
    router.push('/login');
  };

  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) === true;
  };

  const hasRole = (role: string | string[]): boolean => {
    if (!user) return false;
    
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(user.role);
  };

  const isAuthenticated = !!user && !!token;
  const isFullyAuthenticated = !!user && !!token && !!axios.defaults.headers.common['Authorization'];

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    loading,
    isAuthenticated,
    isFullyAuthenticated,
    hasPermission,
    hasRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
