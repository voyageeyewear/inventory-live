#!/bin/bash

echo "🚀 Starting Shopify Inventory Management System..."
echo ""

# Check if MongoDB is running
echo "📊 Checking MongoDB connection..."

# Start backend server
echo "🔧 Starting Backend Server (Port 8080)..."
cd server
npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend server
echo "🎨 Starting Frontend Server (Port 3000)..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Servers started successfully!"
echo "📱 Frontend: http://localhost:3000"
echo "🔌 Backend API: http://localhost:8080"
echo "🏥 Health Check: http://localhost:8080/api/health"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
wait

