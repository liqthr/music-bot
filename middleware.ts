import { NextRequest, NextResponse } from 'next/server'

// Temporarily disabled middleware for debugging
export async function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
