import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

type Params = Promise<{ id: string; userId: string }>

const updateSchema = z.object({
  role: z.enum(['member', 'viewer']),
})

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id, userId } = await params
  const houseId = parseInt(id, 10)
  const targetUserId = parseInt(userId, 10)
  const db = getDb()

  const me = await db.prepare('SELECT role FROM house_members WHERE house_id = ? AND user_id = ?').get(houseId, session.userId) as { role: string } | undefined
  if (!me || me.role !== 'owner') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })
  if (targetUserId === session.userId) return NextResponse.json({ error: 'Kan ikke ændre din egen rolle' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldig rolle' }, { status: 400 })

  await db.prepare('UPDATE house_members SET role = ? WHERE house_id = ? AND user_id = ?').run(parsed.data.role, houseId, targetUserId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id, userId } = await params
  const houseId = parseInt(id, 10)
  const targetUserId = parseInt(userId, 10)
  const db = getDb()

  const me = await db.prepare('SELECT role FROM house_members WHERE house_id = ? AND user_id = ?').get(houseId, session.userId) as { role: string } | undefined
  if (!me || me.role !== 'owner') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })
  if (targetUserId === session.userId) return NextResponse.json({ error: 'Kan ikke fjerne dig selv' }, { status: 400 })

  await db.prepare('DELETE FROM house_members WHERE house_id = ? AND user_id = ?').run(houseId, targetUserId)
  return NextResponse.json({ ok: true })
}
