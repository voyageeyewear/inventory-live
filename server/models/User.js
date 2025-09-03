const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'manager', 'user'],
    default: 'user'
  },
  permissions: {
    // Dashboard access
    viewDashboard: { type: Boolean, default: true },
    
    // Product management
    viewProducts: { type: Boolean, default: true },
    addProducts: { type: Boolean, default: false },
    editProducts: { type: Boolean, default: false },
    deleteProducts: { type: Boolean, default: false },
    
    // Stock management
    viewStock: { type: Boolean, default: true },
    stockIn: { type: Boolean, default: false },
    stockOut: { type: Boolean, default: false },
    
    // Sync operations
    viewSyncActivity: { type: Boolean, default: true },
    syncProducts: { type: Boolean, default: false },
    syncAllStores: { type: Boolean, default: false },
    
    // Reports and analytics
    viewReports: { type: Boolean, default: true },
    exportReports: { type: Boolean, default: false },
    
    // Data management
    viewDataManagement: { type: Boolean, default: false },
    exportBackup: { type: Boolean, default: false },
    importBackup: { type: Boolean, default: false },
    resetData: { type: Boolean, default: false },
    
    // Store management
    viewStores: { type: Boolean, default: true },
    manageStores: { type: Boolean, default: false },
    
    // User management (admin only)
    viewUsers: { type: Boolean, default: false },
    createUsers: { type: Boolean, default: false },
    editUsers: { type: Boolean, default: false },
    deleteUsers: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account locked status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const hashedPassword = await bcrypt.hash(this.password, 12);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: new Date() }
  });
};

// Method to set role-based permissions
userSchema.methods.setRolePermissions = function() {
  switch (this.role) {
    case 'admin':
      // Admin has all permissions
      Object.keys(this.permissions).forEach(permission => {
        this.permissions[permission] = true;
      });
      break;
      
    case 'manager':
      // Manager has most permissions except user management and data reset
      this.permissions = {
        viewDashboard: true,
        viewProducts: true,
        addProducts: true,
        editProducts: true,
        deleteProducts: true,
        viewStock: true,
        stockIn: true,
        stockOut: true,
        viewSyncActivity: true,
        syncProducts: true,
        syncAllStores: true,
        viewReports: true,
        exportReports: true,
        viewDataManagement: true,
        exportBackup: true,
        importBackup: true,
        resetData: false, // Managers cannot reset data
        viewStores: true,
        manageStores: true,
        viewUsers: false, // Managers cannot manage users
        createUsers: false,
        editUsers: false,
        deleteUsers: false
      };
      break;
      
    case 'user':
    default:
      // User has basic read permissions only
      this.permissions = {
        viewDashboard: true,
        viewProducts: true,
        addProducts: false,
        editProducts: false,
        deleteProducts: false,
        viewStock: true,
        stockIn: false,
        stockOut: false,
        viewSyncActivity: true,
        syncProducts: false,
        syncAllStores: false,
        viewReports: true,
        exportReports: false,
        viewDataManagement: false,
        exportBackup: false,
        importBackup: false,
        resetData: false,
        viewStores: true,
        manageStores: false,
        viewUsers: false,
        createUsers: false,
        editUsers: false,
        deleteUsers: false
      };
      break;
  }
};

// Pre-save middleware to set role-based permissions
userSchema.pre('save', function(next) {
  if (this.isModified('role')) {
    this.setRolePermissions();
  }
  next();
});

// Indexes for performance
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', userSchema);
