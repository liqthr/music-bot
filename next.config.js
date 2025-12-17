/** @type {import('next').NextConfig} */
const nextConfig = {
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

// Sentry is temporarily disabled to unblock deployments.
// Set DISABLE_SENTRY=false (or remove this guard) to re-enable.
if (process.env.DISABLE_SENTRY !== 'false') {
  module.exports = nextConfig
} else {
  const { withSentryConfig } = require('@sentry/nextjs')
  module.exports = withSentryConfig(nextConfig, {
    org: 'liqthr',
    project: 'javascript-nextjs',
    silent: !process.env.CI,
    widenClientFileUpload: true,
    tunnelRoute: '/monitoring',
    webpack: {
      automaticVercelMonitors: true,
      treeshake: { removeDebugLogging: true },
    },
  })
}
