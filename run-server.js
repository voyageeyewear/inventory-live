#!/usr/bin/env node

// Simple server runner that bypasses npm and complex spawning
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Shopify Inventory Server...');
console.log('📁 Working directory:', __dirname);

// Start the backend server directly
const serverPath = path.join(__dirname, 'server', 'index.js');
console.log('🔧 Starting backend server:', serverPath);

try {
  // Use require instead of spawn to avoid process issues
  process.chdir(path.join(__dirname, 'server'));
  require('./server/index.js');
} catch (error) {
  console.error('❌ Error starting server:', error.message);
  console.log('');
  console.log('📋 Manual startup instructions:');
  console.log('1. Open Terminal.app (not integrated terminal)');
  console.log('2. cd "/Users/ssenterprises/Inventory System/server"');
  console.log('3. node index.js');
  console.log('');
  console.log('🌐 Then open: http://localhost:8080/api/health');
}

