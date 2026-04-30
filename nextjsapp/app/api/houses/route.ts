import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

function randomInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const db = getDb()
  const houses = db.prepare(`
    SELECT h.id, h.name, h.description, h.owner_id, h.invite_code, h.created_at,
           hm.role AS my_role,
           u.name AS owner_name,
           (SELECT COUNT(*) FROM house_members WHERE house_id = h.id) AS member_count
    FROM houses h
    JOIN house_members hm ON hm.house_id = h.id AND hm.user_id = ?
    JOIN users u ON u.id = h.owner_id
    ORDER BY h.created_at DESC
  `).all(session.userId)

  return NextResponse.json({ houses })
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldig input' }, { status: 400 })

  const { name, description } = parsed.data
  const db = getDb()

  let invite_code: string
  let attempts = 0
  do {
    invite_code = randomInviteCode()
    attempts++
    if (attempts > 20) return NextResponse.json({ error: 'Kunne ikke generere invitationskode' }, { status: 500 })
  } while (db.prepare('SELECT id FROM houses WHERE invite_code = ?').get(invite_code))

  const result = db.prepare(
    'INSERT INTO houses (name, description, owner_id, invite_code) VALUES (?, ?, ?, ?)'
  ).run(name, description ?? null, session.userId, invite_code)

  const houseId = result.lastInsertRowid
  db.prepare(
    "INSERT INTO house_members (house_id, user_id, role) VALUES (?, ?, 'owner')"
  ).run(houseId, session.userId)

  const house = db.prepare(`
    SELECT h.*, hm.role AS my_role, u.name AS owner_name,
           (SELECT COUNT(*) FROM house_members WHERE house_id = h.id) AS member_count
    FROM houses h
    JOIN house_members hm ON hm.house_id = h.id AND hm.user_id = ?
    JOIN users u ON u.id = h.owner_id
    WHERE h.id = ?
  `).get(session.userId, houseId)

  return NextResponse.json({ house }, { status: 201 })
}
