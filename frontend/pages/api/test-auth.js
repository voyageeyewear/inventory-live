const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
  try {
    console.log('=== AUTH TEST API ===');
    console.log('Headers:', req.headers);
    console.log('Authorization header:', req.headers.authorization);
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid authorization header');
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    console.log('Token received:', token.substring(0, 20) + '...');
    
    const jwtSecret = process.env.JWT_SECRET || 'inventory-jwt-secret-2024-secure-key';
    console.log('JWT Secret used:', jwtSecret.substring(0, 10) + '...');
    
    const decoded = jwt.verify(token, jwtSecret);
    console.log('✅ Token decoded successfully:', decoded);
    
    res.status(200).json({ 
      success: true, 
      message: 'Authentication working',
      decoded 
    });
    
  } catch (error) {
    console.log('❌ Auth test error:', error.message);
    res.status(401).json({ 
      error: 'Authentication failed', 
      message: error.message 
    });
  }
}
