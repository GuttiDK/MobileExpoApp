import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

type Params = Promise<{ id: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const roomId = parseInt(id, 10)
  const db = getDb()

  const room = await db.prepare(`
    SELECT r.*, hm.role AS my_role
    FROM rooms r
    JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ?
    WHERE r.id = ?
  `).get(session.userId, roomId)

  if (!room) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 })
  return NextResponse.json({ room })
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
  mqtt_topic: z.string().max(256).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const roomId = parseInt(id, 10)
  const db = getDb()

  const room = await db.prepare('SELECT r.*, hm.role FROM rooms r JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ? WHERE r.id = ?').get(session.userId, roomId) as { role: string } | undefined
  if (!room) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 })
  if ((room as { role: string }).role === 'viewer') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldig input' }, { status: 400 })

  const { name, description, icon, mqtt_topic } = parsed.data
  if (name) await db.prepare('UPDATE rooms SET name = ? WHERE id = ?').run(name, roomId)
  if (description !== undefined) await db.prepare('UPDATE rooms SET description = ? WHERE id = ?').run(description, roomId)
  if (icon) await db.prepare('UPDATE rooms SET icon = ? WHERE id = ?').run(icon, roomId)
  if (mqtt_topic !== undefined) await db.prepare('UPDATE rooms SET mqtt_topic = ? WHERE id = ?').run(mqtt_topic, roomId)

  const updated = await db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId)
  return NextResponse.json({ room: updated })
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const roomId = parseInt(id, 10)
  const db = getDb()

  const room = await db.prepare('SELECT r.id, hm.role FROM rooms r JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ? WHERE r.id = ?').get(session.userId, roomId) as { role: string } | undefined
  if (!room) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 })
  if ((room as { role: string }).role === 'viewer') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  await db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId)
  return NextResponse.json({ ok: true })
}
