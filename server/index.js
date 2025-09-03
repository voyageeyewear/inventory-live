require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

// Import routes
const productsRoutes = require('./routes/products');
const stockRoutes = require('./routes/stock');
const stockLogsRoutes = require('./routes/stockLogs');
const storesRoutes = require('./routes/stores');
const syncRoutes = require('./routes/sync');
const auditRoutes = require('./routes/audit');
const reportsRoutes = require('./routes/reports');
const dataManagementRoutes = require('./routes/dataManagement');

const app = express();
const PORT = process.env.PORT || 8080;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/products', productsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/stock-logs', stockLogsRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/data-management', dataManagementRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Shopify Inventory Management API',
    version: '1.0.0',
    endpoints: {
      products: '/api/products',
      stock: '/api/stock',
      stockLogs: '/api/stock-logs',
      stores: '/api/stores',
      sync: '/api/sync',
      audit: '/api/audit',
      reports: '/api/reports',
      dataManagement: '/api/data-management',
      health: '/api/health'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large' });
  }
  
  if (error.message.includes('CSV')) {
    return res.status(400).json({ message: error.message });
  }
  
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API Documentation: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
