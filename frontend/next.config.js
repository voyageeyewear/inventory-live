/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    // In production, API calls will be handled by Vercel functions
    // In development, proxy to local backend
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8080/api/:path*'
        }
      ]
    }
    return []
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'production' 
      ? '' // Use relative URLs in production (same domain)
      : 'http://localhost:8080'
  }
}

module.exports = nextConfig
