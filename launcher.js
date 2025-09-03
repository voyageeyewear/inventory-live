#!/usr/bin/env node

// Direct Node.js launcher - bypasses all terminal issues
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Shopify Inventory Server Launcher');
console.log('=====================================');

const serverPath = path.join(__dirname, 'server', 'index.js');
console.log('📁 Server path:', serverPath);
console.log('🔄 Starting server...\n');

// Start server directly
try {
  const server = spawn('node', [serverPath], {
    cwd: path.join(__dirname, 'server'),
    stdio: 'inherit'
  });

  server.on('error', (err) => {
    console.error('❌ Failed to start server:', err.message);
    console.log('\n📋 Manual instructions:');
    console.log('1. Open Terminal.app (not VS Code terminal)');
    console.log('2. Run: cd "/Users/ssenterprises/Inventory System/server"');
    console.log('3. Run: node index.js');
  });

  server.on('close', (code) => {
    console.log(`\n🛑 Server stopped with code ${code}`);
  });

} catch (error) {
  console.error('❌ Launcher error:', error.message);
}

