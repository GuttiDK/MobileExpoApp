import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

type Params = Promise<{ id: string }>

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  mqtt_topic: z.string().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const roomId = parseInt(id, 10)
  const db = getDb()

  const room = db.prepare('SELECT r.*, hm.role FROM rooms r JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ? WHERE r.id = ?').get(session.userId, roomId) as { role: string } | undefined
  if (!room) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 })
  if ((room as { role: string }).role === 'viewer') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldig input' }, { status: 400 })

  const { name, description, icon, mqtt_topic } = parsed.data
  if (name) db.prepare('UPDATE rooms SET name = ? WHERE id = ?').run(name, roomId)
  if (description !== undefined) db.prepare('UPDATE rooms SET description = ? WHERE id = ?').run(description, roomId)
  if (icon) db.prepare('UPDATE rooms SET icon = ? WHERE id = ?').run(icon, roomId)
  if (mqtt_topic !== undefined) db.prepare('UPDATE rooms SET mqtt_topic = ? WHERE id = ?').run(mqtt_topic, roomId)

  const updated = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId)
  return NextResponse.json({ room: updated })
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const roomId = parseInt(id, 10)
  const db = getDb()

  const room = db.prepare('SELECT r.id, hm.role FROM rooms r JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ? WHERE r.id = ?').get(session.userId, roomId) as { role: string } | undefined
  if (!room) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 })
  if ((room as { role: string }).role === 'viewer') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId)
  return NextResponse.json({ ok: true })
}
