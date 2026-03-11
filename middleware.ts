import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

// Only initialize Redis if environment variables are present
let redis: Redis | null = null
let searchLimiter: Ratelimit | null = null
let audioLimiter: Ratelimit | null = null
let defaultLimiter: Ratelimit | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })

    // Different limits for different endpoint types
    const createRateLimiter = (requests: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`) => 
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, window),
        analytics: true,
        prefix: 'auralis',
      })

    searchLimiter = createRateLimiter(30, '1 m')
    audioLimiter = createRateLimiter(5, '1 m')
    defaultLimiter = createRateLimiter(20, '1 m')
  } catch (error) {
    console.error('Failed to initialize Redis rate limiter:', error)
  }
}

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

  // Skip rate limiting if Redis is not configured
  if (!redis) {
    return NextResponse.next()
  }

  const limiter = getRateLimiter(request.nextUrl.pathname)
  
  // Skip rate limiting if limiter is not available
  if (!limiter) {
    return NextResponse.next()
  }
  
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  
  try {
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
  } catch (error) {
    console.error('Rate limiting error:', error)
    // Continue without rate limiting if there's an error
    return NextResponse.next()
  }
}

export const config = {
  matcher: '/api/:path*',
}
