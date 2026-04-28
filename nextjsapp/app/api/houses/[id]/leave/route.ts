import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

type Params = Promise<{ id: string }>

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const houseId = parseInt(id, 10)
  const db = getDb()

  const member = db.prepare('SELECT role FROM house_members WHERE house_id = ? AND user_id = ?').get(houseId, session.userId) as { role: string } | undefined
  if (!member) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 })
  if (member.role === 'owner') return NextResponse.json({ error: 'Ejeren kan ikke forlade huset. Slet huset i stedet.' }, { status: 400 })

  db.prepare('DELETE FROM house_members WHERE house_id = ? AND user_id = ?').run(houseId, session.userId)
  return NextResponse.json({ ok: true })
}
