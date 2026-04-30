import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { getAdminSession } from '@/lib/adminCheck'

export async function GET(request: NextRequest) {
  if (!getAdminSession(request)) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const db = getDb()
  const users = db.prepare(
    'SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at ASC'
  ).all()

  return NextResponse.json({ users })
}
