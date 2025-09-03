#!/bin/bash
cd "$(dirname "$0")/server"
echo "🚀 Starting Shopify Inventory Server..."
echo "📁 Working in: $(pwd)"
node index.js

