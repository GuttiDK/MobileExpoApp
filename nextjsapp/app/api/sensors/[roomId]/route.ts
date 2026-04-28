import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

type Params = Promise<{ roomId: string }>

const schema = z.object({
  temperature: z.number().optional(),
  humidity: z.number().optional(),
})

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { roomId } = await params
  const id = parseInt(roomId, 10)
  const db = getDb()

  const room = db.prepare(
    'SELECT r.id, hm.role FROM rooms r JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ? WHERE r.id = ?'
  ).get(session.userId, id) as { role: string } | undefined

  if (!room) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 })
  if ((room as { role: string }).role === 'viewer') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldig input' }, { status: 400 })

  const { temperature, humidity } = parsed.data
  const result = db.prepare(
    'INSERT INTO sensor_readings (room_id, temperature, humidity) VALUES (?, ?, ?)'
  ).run(id, temperature ?? null, humidity ?? null)

  const reading = db.prepare('SELECT * FROM sensor_readings WHERE id = ?').get(result.lastInsertRowid)
  return NextResponse.json({ reading }, { status: 201 })
}
