import { query } from '../../../lib/postgres'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('Debug Reports API - Starting')
    
    // Check token
    const token = req.headers.authorization?.replace('Bearer ', '')
    console.log('Token present:', !!token)
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No token provided',
        debug: {
          hasToken: false,
          headers: Object.keys(req.headers)
        }
      })
    }

    // Decode token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
      console.log('Token decoded successfully:', decoded)
    } catch (error) {
      console.error('Token decode error:', error.message)
      return res.status(401).json({ 
        success: false,
        message: 'Token decode failed',
        debug: {
          hasToken: true,
          decodeError: error.message
        }
      })
    }

    // Check database connection
    let dbTest
    try {
      dbTest = await query('SELECT NOW() as current_time')
      console.log('Database connection test:', dbTest.rows[0])
    } catch (error) {
      console.error('Database connection error:', error.message)
      return res.status(500).json({ 
        success: false,
        message: 'Database connection failed',
        debug: {
          hasToken: true,
          tokenDecoded: true,
          dbError: error.message
        }
      })
    }

    // Check users table
    let usersTable
    try {
      usersTable = await query('SELECT COUNT(*) as user_count FROM users')
      console.log('Users table check:', usersTable.rows[0])
    } catch (error) {
      console.error('Users table error:', error.message)
      return res.status(500).json({ 
        success: false,
        message: 'Users table query failed',
        debug: {
          hasToken: true,
          tokenDecoded: true,
          dbConnected: true,
          usersTableError: error.message
        }
      })
    }

    // Check specific user
    let user
    try {
      const userResult = await query('SELECT id, username, email, is_active, created_at FROM users WHERE id = $1', [decoded.userId])
      console.log('User lookup result:', userResult.rows)
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({ 
          success: false,
          message: 'User not found',
          debug: {
            hasToken: true,
            tokenDecoded: true,
            dbConnected: true,
            usersTableExists: true,
            userId: decoded.userId,
            userNotFound: true
          }
        })
      }

      user = userResult.rows[0]
      console.log('User found:', user)

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({ 
          success: false,
          message: 'User is inactive',
          debug: {
            hasToken: true,
            tokenDecoded: true,
            dbConnected: true,
            usersTableExists: true,
            userFound: true,
            userInactive: true,
            user: user
          }
        })
      }

    } catch (error) {
      console.error('User lookup error:', error.message)
      return res.status(500).json({ 
        success: false,
        message: 'User lookup failed',
        debug: {
          hasToken: true,
          tokenDecoded: true,
          dbConnected: true,
          usersTableExists: true,
          userLookupError: error.message,
          userId: decoded.userId
        }
      })
    }

    // Test basic reports query
    let reportsTest
    try {
      reportsTest = await query('SELECT COUNT(*) as product_count FROM products WHERE is_active = true')
      console.log('Reports test query:', reportsTest.rows[0])
    } catch (error) {
      console.error('Reports test query error:', error.message)
      return res.status(500).json({ 
        success: false,
        message: 'Reports test query failed',
        debug: {
          hasToken: true,
          tokenDecoded: true,
          dbConnected: true,
          usersTableExists: true,
          userFound: true,
          userActive: true,
          reportsTestError: error.message
        }
      })
    }

    // Success response
    res.status(200).json({
      success: true,
      message: 'All checks passed',
      debug: {
        hasToken: true,
        tokenDecoded: true,
        dbConnected: true,
        usersTableExists: true,
        userFound: true,
        userActive: true,
        reportsTestPassed: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_active: user.is_active
        },
        tokenInfo: {
          userId: decoded.userId,
          iat: decoded.iat,
          exp: decoded.exp
        },
        dbInfo: {
          currentTime: dbTest.rows[0].current_time,
          totalUsers: usersTable.rows[0].user_count,
          totalProducts: reportsTest.rows[0].product_count
        }
      }
    })

  } catch (error) {
    console.error('Debug API error:', error)
    res.status(500).json({
      success: false,
      message: 'Debug API failed',
      debug: {
        error: error.message,
        stack: error.stack
      }
    })
  }
}
