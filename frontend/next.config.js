/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    // In development, proxy to local backend
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8080/api/:path*'
        }
      ]
    }
    // In production, proxy to external backend
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'https://your-backend-url.com'}/api/:path*`
      }
    ]
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'production' 
      ? process.env.BACKEND_URL || 'https://your-backend-url.com'
      : 'http://localhost:8080'
  }
}

module.exports = nextConfig
