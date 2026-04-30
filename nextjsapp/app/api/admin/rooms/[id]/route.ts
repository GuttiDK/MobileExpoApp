import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getAdminSession } from '@/lib/adminCheck'

type Params = Promise<{ id: string }>

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
  mqtt_topic: z.string().max(256).nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  if (!getAdminSession(request)) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const { id } = await params
  const roomId = parseInt(id, 10)

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldig input' }, { status: 400 })

  const db = getDb()
  const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId)
  if (!room) return NextResponse.json({ error: 'Rum ikke fundet' }, { status: 404 })

  const { name, description, icon, mqtt_topic } = parsed.data
  if (name) db.prepare('UPDATE rooms SET name = ? WHERE id = ?').run(name, roomId)
  if (description !== undefined) db.prepare('UPDATE rooms SET description = ? WHERE id = ?').run(description, roomId)
  if (icon) db.prepare('UPDATE rooms SET icon = ? WHERE id = ?').run(icon, roomId)
  if (mqtt_topic !== undefined) db.prepare('UPDATE rooms SET mqtt_topic = ? WHERE id = ?').run(mqtt_topic, roomId)

  const updated = db.prepare(`
    SELECT r.*, h.name AS house_name FROM rooms r JOIN houses h ON h.id = r.house_id WHERE r.id = ?
  `).get(roomId)
  return NextResponse.json({ room: updated })
}
