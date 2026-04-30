import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import getDb from '@/lib/db'
import { signToken } from '@/lib/auth'

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  password: z.string().min(6).max(128),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ugyldig input' }, { status: 400 })
  }

  const { name, email, password } = parsed.data
  const db = getDb()

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    return NextResponse.json({ error: 'Email er allerede i brug' }, { status: 409 })
  }

  const password_hash = await bcrypt.hash(password, 10)
  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
  ).run(name, email, password_hash)

  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(result.lastInsertRowid) as { id: number; name: string; email: string; created_at: string }
  const token = signToken({ userId: user.id, email: user.email })

  const response = NextResponse.json({ user, token }, { status: 201 })
  response.cookies.set('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
