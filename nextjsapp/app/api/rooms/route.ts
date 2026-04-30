import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { subscribeRoomTopic } from '@/lib/mqtt'

const schema = z.object({
  house_id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
  mqtt_topic: z.string().max(256).optional(),
})

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldig input' }, { status: 400 })

  const { house_id, name, description, icon, mqtt_topic } = parsed.data
  const db = getDb()

  const member = db.prepare('SELECT role FROM house_members WHERE house_id = ? AND user_id = ?').get(house_id, session.userId) as { role: string } | undefined
  if (!member || member.role === 'viewer') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const result = db.prepare(
    'INSERT INTO rooms (house_id, name, description, icon, mqtt_topic) VALUES (?, ?, ?, ?, ?)'
  ).run(house_id, name, description ?? null, icon ?? '🏠', mqtt_topic ?? null)

  if (mqtt_topic) subscribeRoomTopic(mqtt_topic)

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(result.lastInsertRowid)
  return NextResponse.json({ room }, { status: 201 })
}
