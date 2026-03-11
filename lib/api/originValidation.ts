const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'https://localhost:3000',
].filter(Boolean))

export function validateOrigin(req: Request): Response | null {
  const origin = req.headers.get('origin')
  // Allow same-origin requests (no origin header) and allowed origins
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
