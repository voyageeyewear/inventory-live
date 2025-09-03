const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shopify-inventory');

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.log('💡 To fix this:');
    console.log('   1. Install MongoDB: brew install mongodb-community');
    console.log('   2. Start MongoDB: brew services start mongodb-community');
    console.log('   3. Or use MongoDB Atlas (cloud): https://www.mongodb.com/atlas');
    console.log('');
    console.log('🚀 Server will continue running without database (some features disabled)');
    // Don't exit - let server run without DB for demo purposes
  }
};

module.exports = connectDB;

