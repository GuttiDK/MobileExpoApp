import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

type Params = Promise<{ id: string }>

function randomInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const houseId = parseInt(id, 10)
  const db = getDb()

  const member = await db.prepare('SELECT role FROM house_members WHERE house_id = ? AND user_id = ?').get(houseId, session.userId) as { role: string } | undefined
  if (!member || member.role !== 'owner') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  let invite_code: string
  let attempts = 0
  do {
    invite_code = randomInviteCode()
    attempts++
    if (attempts > 20) return NextResponse.json({ error: 'Fejl' }, { status: 500 })
  } while (await db.prepare('SELECT id FROM houses WHERE invite_code = ? AND id != ?').get(invite_code, houseId))

  await db.prepare('UPDATE houses SET invite_code = ? WHERE id = ?').run(invite_code, houseId)
  return NextResponse.json({ invite_code })
}
