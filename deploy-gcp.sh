#!/bin/bash

# GCP Deployment Script for Inventory Management System
set -e

# Configuration
PROJECT_ID="inventory-system-1758092152"
REGION="us-central1"
SERVICE_NAME="inventory-management"
DB_INSTANCE="inventory-db"
DB_NAME="inventory"
DB_USER="inventory-user"
DB_PASSWORD="SecureInventory2024!"

echo "🚀 Starting GCP deployment..."
echo "📋 Using project: $PROJECT_ID"

# Set the project
gcloud config set project $PROJECT_ID

# Get database connection details
DB_CONNECTION_NAME="$PROJECT_ID:$REGION:$DB_INSTANCE"
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$DB_CONNECTION_NAME"

echo "🏗️ Building and deploying application..."

# Deploy to Cloud Run with all environment variables
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 3000 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --timeout 300 \
  --add-cloudsql-instances $DB_CONNECTION_NAME \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="DATABASE_URL=$DATABASE_URL" \
  --set-env-vars="POSTGRES_URL=$DATABASE_URL" \
  --set-env-vars="JWT_SECRET=inventory-jwt-secret-2024-secure-key" \
  --set-env-vars="NEXTAUTH_SECRET=inventory-nextauth-secret-2024"

echo "✅ Deployment completed!"
echo "🌐 Getting application URL..."
APP_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')
echo "🌐 Your application is available at: $APP_URL"

echo ""
echo "🎉 Deployment Summary:"
echo "   • Project: $PROJECT_ID"
echo "   • Service: $SERVICE_NAME"
echo "   • Region: $REGION"
echo "   • Database: $DB_INSTANCE"
echo "   • URL: $APP_URL"

