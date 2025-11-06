import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i.scdn.co', 'i1.sndcdn.com', 'i.ytimg.com'],
  },
  // Ensure static files are served correctly
  async headers() {
    return [
      {
        source: '/:path*\\.(css|js|png|jpg|jpeg|svg|webp|gif|woff2|ico|flac)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default nextConfig

