#!/usr/bin/env node

// Emergency server starter - bypasses all npm/terminal issues
console.log('🚀 Emergency Server Startup');
console.log('==========================');

const path = require('path');
const fs = require('fs');

// Check if we're in the right directory
const serverDir = path.join(__dirname, 'server');
const serverFile = path.join(serverDir, 'index.js');

if (!fs.existsSync(serverFile)) {
  console.error('❌ Server file not found:', serverFile);
  process.exit(1);
}

console.log('✅ Found server file:', serverFile);
console.log('🔄 Changing to server directory...');

// Change to server directory
process.chdir(serverDir);

console.log('📁 Current directory:', process.cwd());
console.log('🚀 Starting server...');
console.log('');

// Directly require and run the server
try {
  require(serverFile);
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  console.log('');
  console.log('🔧 Troubleshooting:');
  console.log('1. Make sure MongoDB is running');
  console.log('2. Check if port 8080 is available');
  console.log('3. Try: cd server && node index.js');
}

