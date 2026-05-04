import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

const schema = z.object({ invite_code: z.string().min(1).max(10) })

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldig invitationskode' }, { status: 400 })

  const db = getDb()
  const house = await db.prepare('SELECT * FROM houses WHERE invite_code = ?').get(parsed.data.invite_code.toUpperCase()) as
    | { id: number; name: string }
    | undefined

  if (!house) return NextResponse.json({ error: 'Invitationskode ikke fundet' }, { status: 404 })

  const existing = await db.prepare('SELECT id FROM house_members WHERE house_id = ? AND user_id = ?').get(house.id, session.userId)
  if (existing) return NextResponse.json({ error: 'Du er allerede medlem af dette hus' }, { status: 409 })

  await db.prepare("INSERT INTO house_members (house_id, user_id, role) VALUES (?, ?, 'member')").run(house.id, session.userId)

  return NextResponse.json({ message: `Tilsluttet ${house.name}` })
}
