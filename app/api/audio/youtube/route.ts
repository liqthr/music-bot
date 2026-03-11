import { NextRequest, NextResponse } from 'next/server'
import { validateOrigin } from '@/lib/api/originValidation'

export async function GET(req: NextRequest) {
  const originCheck = validateOrigin(req)
  if (originCheck) return originCheck

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const format = searchParams.get('format') ?? 'flac'

  if (!id) {
    return Response.json({ error: 'Missing id' }, { status: 400 })
  }

  const converterUrl = process.env.CONVERTER_SERVICE_URL
  if (!converterUrl) {
    return Response.json({ error: 'Converter not configured' }, { status: 503 })
  }

  const upstream = await fetch(
    `${converterUrl}/convert?id=${id}&format=${format}`,
    { 
      headers: { 
        'x-converter-secret': process.env.CONVERTER_SECRET ?? '' 
      } 
    }
  )

  if (!upstream.ok) {
    return Response.json({ error: 'Converter error' }, { status: upstream.status })
  }

  // Stream directly to client — do not buffer the full file in Lambda memory
  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'audio/flac',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
