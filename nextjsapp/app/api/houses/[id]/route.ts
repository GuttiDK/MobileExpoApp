import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

type Params = Promise<{ id: string }>

function getMember(db: ReturnType<typeof getDb>, houseId: number, userId: number) {
  return db.prepare('SELECT role FROM house_members WHERE house_id = ? AND user_id = ?').get(houseId, userId) as
    | { role: string }
    | undefined
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const houseId = parseInt(id, 10)
  const db = getDb()

  const member = getMember(db, houseId, session.userId)
  if (!member) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 })

  const house = db.prepare(`
    SELECT h.*, hm.role AS my_role, u.name AS owner_name,
           (SELECT COUNT(*) FROM house_members WHERE house_id = h.id) AS member_count
    FROM houses h
    JOIN house_members hm ON hm.house_id = h.id AND hm.user_id = ?
    JOIN users u ON u.id = h.owner_id
    WHERE h.id = ?
  `).get(session.userId, houseId)

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, hm.role, hm.joined_at
    FROM house_members hm
    JOIN users u ON u.id = hm.user_id
    WHERE hm.house_id = ?
    ORDER BY hm.joined_at ASC
  `).all(houseId)

  const rooms = db.prepare(`
    SELECT r.*,
      (SELECT temperature FROM sensor_readings WHERE room_id = r.id ORDER BY recorded_at DESC LIMIT 1) AS last_temperature,
      (SELECT humidity FROM sensor_readings WHERE room_id = r.id ORDER BY recorded_at DESC LIMIT 1) AS last_humidity,
      (SELECT recorded_at FROM sensor_readings WHERE room_id = r.id ORDER BY recorded_at DESC LIMIT 1) AS last_reading_at
    FROM rooms r
    WHERE r.house_id = ?
    ORDER BY r.created_at ASC
  `).all(houseId)

  return NextResponse.json({ house, members, rooms })
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const houseId = parseInt(id, 10)
  const db = getDb()

  const member = getMember(db, houseId, session.userId)
  if (!member || member.role !== 'owner') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldig input' }, { status: 400 })

  const { name, description } = parsed.data
  if (name) db.prepare('UPDATE houses SET name = ? WHERE id = ?').run(name, houseId)
  if (description !== undefined) db.prepare('UPDATE houses SET description = ? WHERE id = ?').run(description, houseId)

  const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(houseId)
  return NextResponse.json({ house })
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const houseId = parseInt(id, 10)
  const db = getDb()

  const member = getMember(db, houseId, session.userId)
  if (!member || member.role !== 'owner') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  db.prepare('DELETE FROM houses WHERE id = ?').run(houseId)
  return NextResponse.json({ ok: true })
}
