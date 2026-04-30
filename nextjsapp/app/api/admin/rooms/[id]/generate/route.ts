import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getAdminSession } from '@/lib/adminCheck'

type Params = Promise<{ id: string }>

const schema = z.object({
  temperature: z.number().min(-50).max(100).optional(),
  humidity: z.number().min(0).max(100).optional(),
  count: z.number().int().min(1).max(50).default(1),
})

export async function POST(request: NextRequest, { params }: { params: Params }) {
  if (!getAdminSession(request)) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const { id } = await params
  const roomId = parseInt(id, 10)

  const db = getDb()
  const room = db.prepare('SELECT id, mqtt_topic FROM rooms WHERE id = ?').get(roomId) as { id: number; mqtt_topic: string | null } | undefined
  if (!room) return NextResponse.json({ error: 'Rum ikke fundet' }, { status: 404 })
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
