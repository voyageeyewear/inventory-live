/** @type {import('next').NextConfig} */
// Force rebuild - v3 - Using Vercel API Routes
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // No rewrites needed - using built-in API routes
  env: {
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'production' 
      ? '' // Use relative URLs in production (same domain)
      : 'http://localhost:8080' // Still use local backend in development
  }
}

module.exports = nextConfig
