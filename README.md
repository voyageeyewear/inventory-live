# 🏪 Multi-Store Inventory Management System

A comprehensive **Shopify Multi-Store Inventory Management System** built with Next.js, Node.js, and MongoDB. This system allows you to manage inventory across multiple Shopify stores from a single dashboard, with CSV upload capabilities, real-time sync, and detailed audit tracking.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)
![Next.js](https://img.shields.io/badge/next.js-13+-black.svg)
![MongoDB](https://img.shields.io/badge/mongodb-6+-green.svg)

## 🌟 Features

### 📊 **Dashboard & Analytics**
- **Real-time Overview**: Comprehensive dashboard with inventory statistics
- **Low Stock Alerts**: Automatic notifications for products running low
- **Recent Activity**: Track all sync and stock movements
- **Visual Analytics**: Charts and graphs for inventory insights

### 🛍️ **Multi-Store Management**
- **Shopify Integration**: Connect multiple Shopify stores via OAuth
- **Centralized Control**: Manage all stores from one interface
- **Store Status Monitoring**: Real-time connection status for each store
- **Bulk Operations**: Sync inventory across all connected stores

### 📦 **Product Management**
- **Master Inventory**: Single source of truth for all product quantities
- **CSV Upload**: Bulk import/update products via CSV files
- **Individual Product Sync**: Selective synchronization per product
- **Multi-Product Sync**: Bulk sync selected products
- **Product Editing**: In-line editing with real-time updates

### 📈 **Stock Operations**
- **Stock-In Management**: Track incoming inventory
- **Stock-Out Management**: Monitor outgoing inventory
- **Automatic Calculations**: Real-time quantity adjustments
- **Audit Trail**: Complete history of all stock movements

### 🔍 **Audit & Tracking**
- **Sync Activity**: Detailed history of all synchronization operations
- **Stock Audit**: Complete log of inventory changes
- **Product History**: Per-product audit trail
- **Error Tracking**: Failed operations with detailed error messages
- **Performance Metrics**: Sync duration and success rates

### 🔧 **Advanced Features**
- **Smart CSV Processing**: Flexible column mapping for various CSV formats
- **Rate Limiting**: Shopify API rate limit compliance
- **Error Handling**: Graceful error recovery and reporting
- **Search & Filtering**: Advanced product search and filtering
- **Pagination**: Efficient handling of large product catalogs

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **MongoDB** (v6 or higher)
- **Git**
- **Shopify Partner Account** (for API access)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/voyageeyewear/local-inventory-management-system.git
   cd local-inventory-management-system
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install frontend dependencies
   cd frontend
   npm install
   
   # Install backend dependencies
   cd ../server
   npm install
   cd ..
   ```

3. **Set up MongoDB**
   ```bash
   # macOS (using Homebrew)
   brew tap mongodb/brew
   brew install mongodb-community
   brew services start mongodb/brew/mongodb-community
   
   # Ubuntu/Debian
   sudo apt-get install mongodb
   sudo systemctl start mongodb
   
   # Windows
   # Download and install from https://www.mongodb.com/try/download/community
   ```

4. **Configure environment variables**
   
   Create `.env` files in both `frontend` and `server` directories:
   
   **Frontend (.env.local):**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```
   
   **Backend (.env):**
   ```env
   PORT=8080
   MONGODB_URI=mongodb://localhost:27017/inventory_management
   SHOPIFY_API_KEY=your_shopify_api_key
   SHOPIFY_API_SECRET=your_shopify_api_secret
   SHOPIFY_SCOPES=read_products,write_products,read_inventory,write_inventory
   ```

5. **Start the application**
   ```bash
   # Option 1: Start both servers simultaneously
   npm run dev
   
   # Option 2: Start servers separately
   # Terminal 1 - Backend
   npm run backend
   
   # Terminal 2 - Frontend
   npm run frontend
   ```

6. **Access the application**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:8080
   - **API Health Check**: http://localhost:8080/api/health

## 📁 Project Structure

```
local-inventory-management-system/
├── 📁 frontend/                 # Next.js Frontend Application
│   ├── 📁 components/          # Reusable React components
│   │   └── Layout.tsx          # Main layout with sidebar navigation
│   ├── 📁 pages/              # Next.js pages
│   │   ├── index.tsx          # Products management page
│   │   ├── dashboard.tsx      # Analytics dashboard
│   │   ├── add-product.tsx    # Add new product form
│   │   ├── sync-activity.tsx  # Sync history and audit
│   │   ├── stock-in.tsx       # Stock-in management
│   │   ├── stock-out.tsx      # Stock-out management
│   │   └── settings.tsx       # Application settings
│   ├── 📁 styles/             # CSS and styling files
│   ├── package.json           # Frontend dependencies
│   └── next.config.js         # Next.js configuration
│
├── 📁 server/                  # Node.js Backend Application
│   ├── 📁 config/             # Configuration files
│   │   └── database.js        # MongoDB connection setup
│   ├── 📁 models/             # Mongoose data models
│   │   ├── Product.js         # Product schema
│   │   ├── Store.js           # Store schema
│   │   ├── SyncAudit.js       # Sync audit schema
│   │   └── StockAudit.js      # Stock audit schema
│   ├── 📁 routes/             # API route handlers
│   │   ├── products.js        # Product CRUD operations
│   │   ├── stores.js          # Store management
│   │   ├── sync.js            # Synchronization operations
│   │   └── audit.js           # Audit and reporting
│   ├── 📁 services/           # Business logic services
│   │   └── shopifyService.js  # Shopify API integration
│   ├── 📁 utils/              # Utility functions
│   │   └── csvParser.js       # CSV processing utilities
│   ├── 📁 middleware/         # Express middleware
│   │   └── upload.js          # File upload handling
│   ├── package.json           # Backend dependencies
│   └── index.js               # Express server entry point
│
├── 📁 sample-data/            # Sample CSV files and templates
│   ├── products-template.csv   # Basic product template
│   └── products-shopify-format.csv # Shopify export format
│
├── 📁 .vscode/               # VS Code configuration
│   ├── launch.json           # Debug configuration
│   └── tasks.json            # Task runner configuration
│
├── 📄 CSV_FORMAT_GUIDE.md    # CSV format documentation
├── 📄 package.json           # Root package.json with scripts
├── 📄 .gitignore            # Git ignore rules
└── 📄 README.md             # This file
```

## 🔧 Configuration

### Shopify API Setup

1. **Create a Shopify Partner Account**
   - Visit [Shopify Partners](https://partners.shopify.com/)
   - Create a new app in your partner dashboard

2. **Configure App Settings**
   - Set **App URL**: `http://localhost:3000`
   - Set **Allowed redirection URL(s)**: `http://localhost:8080/auth/shopify/callback`
   - Note down your **API Key** and **API Secret**

3. **Set Required Scopes**
   ```
   read_products, write_products, read_inventory, write_inventory
   ```

### MongoDB Configuration

The application uses MongoDB to store:
- **Products**: Master inventory data
- **Stores**: Connected Shopify store information
- **Sync Audit**: History of synchronization operations
- **Stock Audit**: History of stock movements

Default connection: `mongodb://localhost:27017/inventory_management`

## 📊 API Documentation

### Products API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | Get all products |
| POST | `/api/products` | Create new product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| POST | `/api/products/upload` | Upload CSV file |

### Stores API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stores` | Get all connected stores |
| POST | `/api/stores` | Add new store |
| PUT | `/api/stores/:id` | Update store |
| DELETE | `/api/stores/:id` | Remove store |

### Sync API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync/all` | Sync all products to all stores |
| POST | `/api/sync/test-one` | Sync single product (test) |
| POST | `/api/sync/multi` | Sync multiple selected products |

### Audit API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit/dashboard` | Get dashboard statistics |
| GET | `/api/audit/sync` | Get sync history |
| GET | `/api/audit/stock` | Get stock movement history |
| GET | `/api/audit/product/:sku` | Get product-specific audit |

## 📋 CSV Upload Format

The system supports multiple CSV formats. Here are the supported column names:

### Product Information
- **SKU**: `SKU`, `sku`, `Variant SKU`, `variant_sku`
- **Product Name**: `Product Name`, `product_name`, `Title`, `title`
- **Quantity**: `Quantity`, `quantity`, `Variant Inventory Qty`, `variant_inventory_qty`
- **Image URL**: `Image`, `image`, `image_url`, `Image Src`, `image_src`

### Sample CSV Format
```csv
Title,Type,Variant SKU,Variant Inventory Qty,Image Src
Sample Product,Physical,SKU123,100,https://example.com/image.jpg
Another Product,Physical,SKU456,50,https://example.com/image2.jpg
```

## 🔍 Features in Detail

### Dashboard Analytics
- **Total Products**: Count of all products in inventory
- **Total Stores**: Number of connected Shopify stores
- **Recent Syncs**: Latest synchronization operations
- **Low Stock Alerts**: Products below threshold quantities
- **Sync Success Rate**: Performance metrics and statistics

### Product Management
- **Bulk Import**: Upload thousands of products via CSV
- **Individual Editing**: In-line editing with real-time updates
- **Image Management**: Support for product images via URLs
- **Search & Filter**: Advanced filtering by SKU, name, quantity
- **Pagination**: Efficient handling of large catalogs

### Sync Operations
- **Smart Sync**: Only updates products with quantity changes
- **Rate Limiting**: Respects Shopify API rate limits (2 calls/second)
- **Error Recovery**: Graceful handling of API failures
- **Batch Processing**: Efficient bulk operations
- **Real-time Status**: Live updates during sync operations

### Audit System
- **Comprehensive Logging**: Every operation is tracked
- **Detailed History**: Who, what, when, and how much
- **Error Tracking**: Failed operations with error messages
- **Performance Metrics**: Sync duration and success rates
- **Filtering**: Search audit logs by date, product, store, or action

## 🛠️ Development

### Running in Development Mode

1. **Start MongoDB**
   ```bash
   brew services start mongodb/brew/mongodb-community
   ```

2. **Start Backend (Terminal 1)**
   ```bash
   cd server
   npm run dev
   ```

3. **Start Frontend (Terminal 2)**
   ```bash
   cd frontend
   npm run dev
   ```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both frontend and backend |
| `npm run backend` | Start only backend server |
| `npm run frontend` | Start only frontend server |
| `npm run build` | Build frontend for production |
| `npm start` | Start production servers |

### Debugging

The project includes VS Code debug configurations:
- **Debug Backend**: Attach to Node.js backend
- **Debug Frontend**: Attach to Next.js frontend

## 🔒 Security Considerations

- **API Keys**: Never commit API keys to version control
- **Environment Variables**: Use `.env` files for sensitive data
- **Input Validation**: All CSV uploads are validated
- **Rate Limiting**: Shopify API rate limits are respected
- **Error Handling**: Graceful error handling prevents crashes

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   # Set production environment variables
   NODE_ENV=production
   MONGODB_URI=mongodb://your-production-db
   SHOPIFY_API_KEY=your-production-key
   SHOPIFY_API_SECRET=your-production-secret
   ```

2. **Build Application**
   ```bash
   cd frontend
   npm run build
   
   cd ../server
   npm install --production
   ```

3. **Start Production Servers**
   ```bash
   # Backend
   cd server
   npm start
   
   # Frontend (or use a service like Vercel)
   cd frontend
   npm start
   ```

### Recommended Hosting

- **Frontend**: Vercel, Netlify, or AWS Amplify
- **Backend**: Heroku, AWS EC2, or DigitalOcean
- **Database**: MongoDB Atlas, AWS DocumentDB

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow **ESLint** and **Prettier** configurations
- Write **meaningful commit messages**
- Add **tests** for new features
- Update **documentation** for API changes
- Ensure **TypeScript** compliance

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   ```bash
   # Start MongoDB service
   brew services start mongodb/brew/mongodb-community
   ```

2. **Port Already in Use**
   ```bash
   # Kill processes on ports 3000 and 8080
   lsof -ti:3000 | xargs kill -9
   lsof -ti:8080 | xargs kill -9
   ```

3. **Shopify API Errors**
   - Verify API credentials in `.env` file
   - Check Shopify app permissions and scopes
   - Ensure store is properly connected

4. **CSV Upload Issues**
   - Check CSV format matches supported columns
   - Verify file encoding (UTF-8 recommended)
   - Ensure required fields (SKU, Product Name, Quantity) are present

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/voyageeyewear/local-inventory-management-system/issues)
- **Discussions**: [GitHub Discussions](https://github.com/voyageeyewear/local-inventory-management-system/discussions)
- **Documentation**: Check the `CSV_FORMAT_GUIDE.md` for detailed CSV format help

## 🙏 Acknowledgments

- **Shopify** for their comprehensive API
- **Next.js** team for the amazing React framework
- **MongoDB** for the flexible database solution
- **Tailwind CSS** for the beautiful UI components
- **Lucide React** for the icon library

---

**Built with ❤️ for efficient inventory management across multiple Shopify stores.**