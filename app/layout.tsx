import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AURALIS - Music Player',
  description: 'Search and play music from Spotify, SoundCloud, and YouTube',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
