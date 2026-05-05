import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import getDb from '@/lib/db'

const schema = z.object({
  token: z.string().min(1).max(128),
  password: z.string().min(6).max(128),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ugyldigt input' }, { status: 400 })
  }

  const { token, password } = parsed.data
  const db = getDb()

  const row = await db.prepare(
    'SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?'
  ).get(token) as { user_id: number; expires_at: string } | undefined

  if (!row) {
    return NextResponse.json({ error: 'Ugyldigt eller udløbet link' }, { status: 400 })
  }

  if (new Date(row.expires_at) < new Date()) {
    await db.query('DELETE FROM password_reset_tokens WHERE token = ?').run(token)
    return NextResponse.json({ error: 'Linket er udløbet' }, { status: 400 })
  }

  const hash = await bcrypt.hash(password, 12)

  await db.query('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id)
  await db.query('DELETE FROM password_reset_tokens WHERE user_id = ?').run(row.user_id)

  return NextResponse.json({ ok: true })
}
