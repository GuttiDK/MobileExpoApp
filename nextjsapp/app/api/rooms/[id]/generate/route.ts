import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

type Params = Promise<{ id: string }>

const schema = z.object({
  temperature: z.number().min(-50).max(100).optional(),
  humidity: z.number().min(0).max(100).optional(),
  count: z.number().int().min(1).max(50).default(1),
})

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const roomId = parseInt(id, 10)
  const db = getDb()

  const room = db.prepare(`
    SELECT r.id, r.mqtt_topic, hm.role
    FROM rooms r
    JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ?
    WHERE r.id = ?
  `).get(session.userId, roomId) as { id: number; mqtt_topic: string | null; role: string } | undefined

  if (!room) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 })
  if (room.role === 'viewer') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })
  if (!room.mqtt_topic) return NextResponse.json({ error: 'Rummet har ikke et MQTT emne' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldig input' }, { status: 400 })

  const { count } = parsed.data
  const insert = db.prepare('INSERT INTO sensor_readings (room_id, temperature, humidity) VALUES (?, ?, ?)')
  const insertMany = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const temp = parsed.data.temperature ?? parseFloat((18 + Math.random() * 10).toFixed(1))
      const hum = parsed.data.humidity ?? parseFloat((40 + Math.random() * 30).toFixed(1))
      insert.run(roomId, temp, hum)
    }
  })
  insertMany()

  return NextResponse.json({ ok: true, count })
}
