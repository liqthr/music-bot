import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Different limits for different endpoint types
const createRateLimiter = (requests: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`) => 
  new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix: 'auralis',
  })

const searchLimiter = createRateLimiter(30, '1 m')
const audioLimiter = createRateLimiter(5, '1 m')
const defaultLimiter = createRateLimiter(20, '1 m')

function getRateLimiter(pathname: string) {
  if (pathname.includes('/search/')) return searchLimiter
  if (pathname.includes('/audio/')) return audioLimiter
  return defaultLimiter
}

export async function middleware(request: NextRequest) {
  // Only apply to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const limiter = getRateLimiter(request.nextUrl.pathname)
  
  const { success, limit, remaining, reset } = await limiter.limit(ip)

  if (!success) {
    return new NextResponse(
      JSON.stringify({ 
        error: 'Too Many Requests', 
        retryAfter: Math.round((reset - Date.now()) / 1000) 
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': new Date(reset).toISOString(),
          'Retry-After': String(Math.round((reset - Date.now()) / 1000)),
        },
      }
    )
  }

  return NextResponse.next({
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
    },
  })
}

export const config = {
  matcher: '/api/:path*',
}
