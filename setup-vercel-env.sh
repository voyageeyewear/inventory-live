#!/bin/bash

echo "🚀 Setting up Vercel Environment Variables..."

# Set MongoDB URI (you'll need to replace with your actual MongoDB connection string)
vercel env add MONGODB_URI production
# When prompted, enter: mongodb+srv://username:password@cluster.mongodb.net/inventory_system

# Set JWT Secret
vercel env add JWT_SECRET production
# When prompted, enter: your-super-secret-jwt-key-change-this-in-production

# Set Node Environment
vercel env add NODE_ENV production
# When prompted, enter: production

echo "✅ Environment variables setup complete!"
echo "📝 Next steps:"
echo "1. Replace the MongoDB URI with your actual connection string"
echo "2. Change the JWT_SECRET to a secure random string"
echo "3. Redeploy your application: vercel --prod"
