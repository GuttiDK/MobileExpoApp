import { NextRequest } from 'next/server'
import { getSessionFromRequest, TokenPayload } from './auth'
import getDb from './db'

export function getAdminSession(request: NextRequest): TokenPayload | null {
  const session = getSessionFromRequest(request)
  if (!session) return null
  const db = getDb()
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(session.userId) as { is_admin: number } | undefined
  if (!user?.is_admin) return null
  return session
}
