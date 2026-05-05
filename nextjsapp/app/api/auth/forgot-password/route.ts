import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import getDb from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'

const schema = z.object({ email: z.string().email().max(254) })

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ugyldig email' }, { status: 400 })
  }

  const { email } = parsed.data
  const db = getDb()

  const user = await db.prepare('SELECT id, name FROM users WHERE email = ?').get(email) as
    | { id: number; name: string }
    | undefined

  // Always return success to avoid user enumeration
  if (!user) {
    return NextResponse.json({ ok: true })
  }

  // Delete any existing tokens for this user
  await db.query('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id)

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.query(
    'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).run(user.id, token, expiresAt.toISOString())

  await sendPasswordResetEmail(email, user.name, token)

  return NextResponse.json({ ok: true })
}
