import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import './globals.css'

// Attach Sentry trace data to metadata for better trace linking in Sentry
export function generateMetadata(): Metadata {
  return {
    title: 'AURALIS - Music Player',
    description:
      'Search and play music from Spotify, SoundCloud, and YouTube',
    other: {
      ...Sentry.getTraceData(),
    },
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload Font Awesome for faster icon loading */}
        <link
          rel="preload"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-brands-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-solid-900.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        {children}
      </body>
    </html>
  )
}
