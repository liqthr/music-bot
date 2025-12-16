import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export async function GET() {
  Sentry.captureException(new Error('Sentry test route error'))

  return NextResponse.json({ ok: true })
}
