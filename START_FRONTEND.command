#!/bin/bash
echo "🎨 Starting Frontend Server"
echo "=========================="

# Navigate to frontend directory
cd "$(dirname "$0")/frontend"
echo "📁 Working in: $(pwd)"

echo ""
echo "🚀 Starting Next.js development server..."
npm run dev
