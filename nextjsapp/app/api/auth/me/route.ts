import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })
  }

  const db = getDb()
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(session.userId) as
    | { id: number; name: string; email: string; created_at: string }
    | undefined

  if (!user) {
    return NextResponse.json({ error: 'Bruger ikke fundet' }, { status: 404 })
  }

  return NextResponse.json({ user })
}
