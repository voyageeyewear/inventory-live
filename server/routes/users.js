const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken, requirePermission, requireRole } = require('../middleware/auth');

// Get all users (admin/manager only)
router.get('/', authenticateToken, requirePermission('viewUsers'), async (req, res) => {
  try {
    const { page = 1, limit = 10, role, isActive, search } = req.query;
    
    // Build filter
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .populate('createdBy', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Get user by ID (admin/manager only)
router.get('/:id', authenticateToken, requirePermission('viewUsers'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('createdBy', 'username firstName lastName');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

// Create new user (admin only)
router.post('/', authenticateToken, requirePermission('createUsers'), async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role, permissions } = req.body;

    // Validate required fields
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Create new user
    const userData = {
      username,
      email,
      password,
      firstName,
      lastName,
      role: role || 'user',
      createdBy: req.user._id
    };

    // If custom permissions provided and user is admin
    if (permissions && req.user.role === 'admin') {
      userData.permissions = permissions;
    }

    const user = new User(userData);
    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    console.log(`👤 New user created by ${req.user.username}: ${username} (${email})`);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user: userResponse }
    });

  } catch (error) {
    console.error('Create user error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'User creation failed'
    });
  }
});

// Update user (admin/manager only)
router.put('/:id', authenticateToken, requirePermission('editUsers'), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, firstName, lastName, role, permissions, isActive } = req.body;

    // Prevent users from editing themselves through this endpoint
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Use profile endpoint to edit your own account'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent non-admins from editing admin users
    if (user.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot edit admin users'
      });
    }

    // Check if email/username is already taken by another user
    if ((email && email !== user.email) || (username && username !== user.username)) {
      const existingUser = await User.findOne({
        $or: [
          ...(email ? [{ email }] : []),
          ...(username ? [{ username }] : [])
        ],
        _id: { $ne: id }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email or username is already taken'
        });
      }
    }

    // Build update object
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Only admins can change roles and permissions
    if (req.user.role === 'admin') {
      if (role) updateData.role = role;
      if (permissions) updateData.permissions = permissions;
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    console.log(`👤 User updated by ${req.user.username}: ${updatedUser.username}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'User update failed'
    });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requirePermission('deleteUsers'), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent users from deleting themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting other admin users (only super admin can do this)
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }

    await User.findByIdAndDelete(id);

    console.log(`🗑️ User deleted by ${req.user.username}: ${user.username} (${user.email})`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'User deletion failed'
    });
  }
});

// Reset user password (admin only)
router.post('/:id/reset-password', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password and reset login attempts
    user.password = newPassword;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    console.log(`🔒 Password reset by ${req.user.username} for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset failed'
    });
  }
});

// Unlock user account (admin only)
router.post('/:id/unlock', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      {
        $unset: { loginAttempts: 1, lockUntil: 1 },
        isActive: true
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`🔓 Account unlocked by ${req.user.username} for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Account unlocked successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Unlock user error:', error);
    res.status(500).json({
      success: false,
      message: 'Account unlock failed'
    });
  }
});

// Get user statistics (admin only)
router.get('/stats/overview', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      lockedUsers,
      adminUsers,
      managerUsers,
      regularUsers,
      recentUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ lockUntil: { $gt: new Date() } }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'manager' }),
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      })
    ]);

    const stats = {
      overview: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        lockedUsers
      },
      byRole: {
        admin: adminUsers,
        manager: managerUsers,
        user: regularUsers
      },
      recent: {
        newUsersLast7Days: recentUsers
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics'
    });
  }
});

module.exports = router;
