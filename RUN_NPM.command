#!/bin/bash
echo "🚀 NPM Runner for Shopify Inventory System"
echo "=========================================="

# Navigate to project directory
cd "$(dirname "$0")"
echo "📁 Working in: $(pwd)"

echo ""
echo "🔧 Installing dependencies..."
npm install

echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

echo ""
echo "🔙 Installing backend dependencies..."
cd ../server
npm install

echo ""
echo "✅ All dependencies installed!"
echo ""
echo "🚀 Starting backend server on port 8080..."
node index.js
