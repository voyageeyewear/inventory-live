# 📦 Voyage Eyewear Inventory Management System

A comprehensive full-stack inventory management system with barcode scanning capabilities, built for Voyage Eyewear. This system includes a web dashboard for administrators and a mobile app for warehouse staff to manage inventory efficiently.

## 🌟 Features

### 🖥️ Web Dashboard
- **Product Management**: Add, edit, delete, and view products with images
- **Smart Sync System**: Sync only modified products to save time and API costs
- **Inventory Tracking**: Real-time stock levels with automatic updates
- **CSV Import/Export**: Bulk product uploads with duplicate SKU consolidation
- **Shopify Integration**: Sync inventory with connected Shopify stores
- **Shopify vs Local Inventory**: Compare local and Shopify store inventory
- **Mobile Transaction Approval**: Review and approve mobile app transactions
- **Comprehensive Reporting**: Detailed analytics and audit trails
- **Sync Activity Dashboard**: Unified activity log with consolidation features
- **Most Selling Products**: Analytics with real sales data and performance metrics
- **Low Quantity Alert**: Smart alerts for products below threshold
- **User Management**: Role-based access control
- **Scan History**: Track all barcode scans and mobile activities
- **Data Management**: Reset histories, backup, and bulk operations

### 📱 Mobile App
- **Barcode Scanning**: Fast and accurate barcode recognition
- **Stock Management**: Stock in/out operations with approval workflow
- **Offline Capability**: Works without internet connection
- **Real-time Sync**: Automatic data synchronization when online
- **User Authentication**: Secure login with JWT tokens

## 🚀 Live Demo

### 🌐 Web Dashboard
**URL**: https://inventory-management-production.up.railway.app

**Demo Credentials**:
- **Username**: `admin`
- **Password**: `admin123`

### 📱 Mobile Apps
**Latest APK Files**:
- **Inventory Scanner Pro**: `InventoryBarcodeScanner_Pro_Fixed.apk` (63.6 MB) ✅ **🆕 FIXED INTEGRATION VERSION**
  - 🎨 **Modern Design**: Professional UI with Material Design 3
  - 🔊 **Beep Sound**: Audio feedback on successful scans
  - 📊 **Activity Tracking**: View scan history and approval status
  - 🚀 **Enhanced UX**: Smooth animations and improved experience
- **Previous Version**: `InventoryBarcodeScanner_Latest.apk` (60 MB) ✅ **FIXED BLACK SCREEN ISSUE**
- **Legacy App**: `InventoryScanner_ScanHistory_Latest.apk` (59 MB)
- **Debug Version**: `InventoryBarcodeScanner_Debug.apk` (155 MB)

**Demo Credentials**:
- **Username**: `admin`
- **Password**: `admin123`

📋 **Installation Guides**: 
- **Professional Version**: See `MOBILE_APP_INSTALL_PROFESSIONAL.md` for the latest Pro version
- **Previous Versions**: See `MOBILE_APP_INSTALL_UPDATED.md` for older versions

🔧 **Recent Fix**: Fixed navigation issue that caused black screen after transaction submission

## 🏗️ Architecture

### Frontend (Web Dashboard)
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Lucide React icons
- **State Management**: React Context API
- **Authentication**: JWT with axios interceptors

### Backend (API)
- **Runtime**: Node.js with Next.js API routes
- **Database**: PostgreSQL (Neon)
- **Authentication**: JWT tokens
- **File Upload**: Formidable with CSV parsing
- **External APIs**: Shopify REST API

### Mobile App
- **Framework**: Flutter
- **Language**: Dart
- **Barcode Scanning**: mobile_scanner package
- **HTTP Client**: http package
- **Local Storage**: shared_preferences
- **Permissions**: camera, internet, vibration

### Deployment
- **Platform**: Railway (Primary), Vercel (Backup)
- **Database**: Neon PostgreSQL
- **CDN**: Railway Edge Network
- **SSL**: Automatic HTTPS

## 📋 Prerequisites

- Node.js 18+ and npm
- Flutter SDK 3.0+
- PostgreSQL database (or Neon account)
- Vercel account (for deployment)
- Android Studio (for mobile app development)

## 🛠️ Installation & Setup

### 1. Clone Repository
   ```bash
git clone https://github.com/voyageeyewear/inventory-live.git
cd inventory-live
```

### 2. Environment Variables
Create `.env.local` in the `frontend` directory:
```env
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# Shopify Store Credentials
DEVELOPMENT_STORE_ACCESS_TOKEN=your-shopify-access-token
```

### 3. Install Dependencies
   ```bash
   cd frontend
   npm install
   ```

### 4. Database Setup
   ```bash
# Initialize database tables
npm run dev
# Visit: http://localhost:3000/api/init-db
```

### 5. Run Development Server
```bash
npm run dev
# Visit: http://localhost:3000
```

### 6. Mobile App Setup
```bash
cd inventory_barcode_scanner
flutter pub get
flutter run
```

## 📱 Mobile App Build

### Android APK
   ```bash
cd inventory_barcode_scanner
flutter build apk --release
```

### iOS (requires macOS and Xcode)
```bash
cd inventory_barcode_scanner
flutter build ios --release
```

## 🌐 Deployment

### Railway Deployment (Recommended)
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway up
```

### Vercel Deployment (Alternative)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables
Set these in your deployment platform dashboard:
- `DATABASE_URL`
- `JWT_SECRET`
- `DEVELOPMENT_STORE_ACCESS_TOKEN`

## 📊 Database Schema

### Core Tables
- **users**: User accounts and authentication
- **products**: Product catalog with SKU, name, quantity, images
- **stores**: Connected Shopify stores
- **mobile_transactions**: Pending mobile app transactions
- **stock_logs**: Inventory movement history
- **scan_logs**: Barcode scan tracking

### Key Relationships
- Products → Stock Logs (1:many)
- Users → Mobile Transactions (1:many)
- Stores → Stock Logs (1:many)
- Products → Mobile Transactions (1:many)

## 🎯 Usage Guide

### Web Dashboard

#### 1. Login
- Navigate to the login page
- Use demo credentials or create new account
- Dashboard loads with overview statistics

#### 2. Product Management
- **View Products**: Main products page with search and filters
- **Add Product**: Use "Add Product" form with image upload
- **Edit Product**: Click edit button on any product
- **CSV Upload**: Bulk import products via CSV file with duplicate SKU consolidation
- **Smart Sync**: Sync only modified products to save time and API costs
- **Shopify vs Local**: Compare inventory between local system and Shopify stores

#### 3. Mobile Approvals
- **View Pending**: See all mobile app transactions awaiting approval
- **Approve/Reject**: Review and process mobile transactions
- **Auto-update**: Approved transactions update product quantities

#### 4. Scan History
- **View Scans**: See all barcode scans from mobile app
- **Search/Filter**: Find specific scans by SKU or user
- **Statistics**: Overview of scanning activity

#### 5. Reports & Analytics
- **Dashboard**: Key metrics and recent activity
- **Product Reports**: Detailed product analytics
- **Audit Reports**: Product-wise change history
- **Sync Activity**: Unified activity log with consolidation features
- **Most Selling Products**: Analytics with real sales data and performance metrics
- **Low Quantity Alert**: Smart alerts for products below threshold

#### 6. Stock Management
- **Stock In**: Add inventory with CSV upload and detailed reporting
- **Stock Out**: Remove inventory with CSV upload and detailed reporting
- **Duplicate Consolidation**: Automatic SKU consolidation with quantity summation
- **Detailed Reports**: Success/error reports with quantity changes

#### 7. Data Management
- **Reset Histories**: Clear audit trails, sync history, and scan logs
- **Backup Operations**: Export data and create backups
- **Bulk Operations**: Delete all products, reset specific data types
- **Store Management**: Add, edit, delete, and test Shopify store connections

### Mobile App

#### 1. Login
- Open app and enter credentials
- Test connectivity with "Test Connection" button
- Navigate to home screen after successful login

#### 2. Barcode Scanning
- Tap "Start Scan" to open camera
- Point camera at barcode
- App automatically detects and searches product
- Manual input available via keyboard icon

#### 3. Stock Transactions
- After scanning, select transaction type (Stock In/Out)
- Enter quantity and optional notes
- Submit for admin approval
- View confirmation message

#### 4. Offline Mode
- App works without internet connection
- Transactions queued for sync when online
- Automatic retry mechanism

## 🔧 Configuration

### Shopify Integration
1. Create Shopify private app
2. Generate access token with inventory permissions
3. Add store details in Settings tab
4. Test connection and sync products

### User Roles & Permissions
- **Admin**: Full access to all features
- **Manager**: Product and inventory management
- **Staff**: Basic product viewing and mobile app access

### Mobile App Configuration
Update API URL in `lib/services/api_service.dart`:
```dart
static const String baseUrl = 'https://your-domain.vercel.app';
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Mobile App Login Failed
- Check API URL in `api_service.dart`
- Verify internet connection
- Use "Test Connection" button
- Check server logs for authentication errors

#### 2. Barcode Scanner Not Working
- Grant camera permissions
- Ensure good lighting
- Try manual input option
- Check device compatibility

#### 3. Sync Issues
- Verify Shopify credentials
- Check store connection status
- Review sync activity logs
- Ensure products exist in both systems

#### 4. Database Connection
- Verify DATABASE_URL format
- Check Neon database status
- Review connection pool settings
- Monitor database logs

### Debug Mode
Enable debug logging in mobile app:
```dart
// In api_service.dart
print('🔍 Debug: $debugMessage');
```

## 📈 Performance Optimization

### Web Dashboard
- Image optimization with Next.js
- API route caching
- Pagination for large datasets
- Lazy loading components

### Mobile App
- Efficient barcode scanning
- Background sync queuing
- Local data caching
- Memory management

### Database
- Indexed queries on SKU and user_id
- Connection pooling
- Query optimization
- Regular maintenance

## 🔒 Security

### Authentication
- JWT tokens with expiration
- Secure password hashing
- Role-based access control
- Session management

### API Security
- Request validation
- SQL injection prevention
- Rate limiting
- CORS configuration

### Mobile Security
- Secure token storage
- HTTPS only communication
- Certificate pinning
- Data encryption

## 🧪 Testing

### Web Dashboard
   ```bash
cd frontend
npm run test
   ```

### Mobile App
   ```bash
cd inventory_barcode_scanner
flutter test
   ```

### API Testing
   ```bash
# Test endpoints with curl
curl -X GET "https://your-domain.vercel.app/api/health"
```

## 📝 API Documentation

### Authentication
```
POST /api/auth/login
Body: { username, password }
Response: { token, user }
```

### Products
```
GET /api/products
GET /api/products?search=SKU
POST /api/products
PUT /api/products/edit
DELETE /api/products/delete
```

### Mobile Transactions
```
GET /api/mobile-transactions
POST /api/mobile-transactions
POST /api/mobile-transactions/approve
```

### Scan History
```
GET /api/scan-history
POST /api/scan-logs
```

## 🤝 Contributing

1. Fork the repository: [https://github.com/voyageeyewear/inventory-live](https://github.com/voyageeyewear/inventory-live)
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is proprietary software developed for Voyage Eyewear.

## 👥 Support

For technical support or questions:
- **Email**: support@voyageeyewear.com
- **Documentation**: This README file
- **Issues**: GitHub Issues (if applicable)

## 🔄 Version History

### v2.1.0 (Current)
- ✅ Smart sync system for modified products only
- ✅ Shopify vs Local Inventory comparison
- ✅ Most Selling Products analytics dashboard
- ✅ Low Quantity Alert system
- ✅ Enhanced sync activity with consolidation
- ✅ CSV upload with duplicate SKU consolidation
- ✅ Detailed stock in/out reporting
- ✅ Comprehensive data management tools
- ✅ Railway deployment support

### v2.0.0 (Previous)
- ✅ Complete system rebuild with PostgreSQL
- ✅ Mobile app with barcode scanning
- ✅ Shopify integration
- ✅ Mobile transaction approval workflow
- ✅ Comprehensive scan history
- ✅ Clean sidebar navigation
- ✅ Professional header design
- ✅ Detailed audit trails

### v1.0.0 (Legacy)
- Basic inventory management
- MongoDB backend
- Limited mobile functionality

## 🎯 Roadmap

### Upcoming Features
- [ ] Multi-language support
- [ ] Advanced reporting with charts and graphs
- [ ] Automated email alerts for low stock
- [ ] Supplier management
- [ ] Warehouse locations
- [ ] Batch operations
- [ ] Export to Excel/PDF
- [ ] Mobile push notifications
- [ ] Real-time inventory updates
- [ ] Advanced product analytics

### Technical Improvements
- [ ] GraphQL API
- [ ] Real-time WebSocket updates
- [ ] Progressive Web App (PWA)
- [ ] Advanced caching strategies
- [ ] Microservices architecture
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Automated testing suite

---

## 🆕 Recent Updates

### Latest Improvements (January 2025)
- **✅ Smart Sync System**: Only syncs modified products, saving time and API costs
- **✅ Shopify vs Local Inventory**: Real-time comparison with detailed analytics
- **✅ Most Selling Products**: Analytics dashboard with real sales data and performance metrics
- **✅ Low Quantity Alert**: Smart alerts system for products below threshold
- **✅ Enhanced CSV Upload**: Automatic duplicate SKU consolidation with detailed reporting
- **✅ Sync Activity Dashboard**: Unified activity log with consolidation features
- **✅ Railway Deployment**: Improved deployment process with Railway platform
- **✅ Comprehensive Data Management**: Reset histories, backup, and bulk operations

### Performance Enhancements
- **🚀 Faster Sync Operations**: Smart sync reduces API calls by 90%
- **📊 Real-time Analytics**: Live data updates for better decision making
- **🔄 Improved Error Handling**: Better error messages and recovery mechanisms
- **💾 Enhanced Data Processing**: Efficient CSV processing with duplicate consolidation

---

**Built with ❤️ for Voyage Eyewear**

*Last Updated: January 2025*