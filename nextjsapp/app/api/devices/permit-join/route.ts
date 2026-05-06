import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromRequest } from '@/lib/auth'
import { publishZ2m } from '@/lib/mqtt'

const schema = z.object({
  value: z.boolean(),
  time: z.number().int().min(0).max(254).optional(),
})

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldig input' }, { status: 400 })

  const { value, time } = parsed.data
  const ok = publishZ2m('bridge/request/permit_join', { value, time: time ?? (value ? 254 : 0) })
  if (!ok) return NextResponse.json({ error: 'MQTT ikke tilsluttet' }, { status: 503 })

  return NextResponse.json({ ok: true, value, time: time ?? (value ? 254 : 0) })
}
