import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import getDb from '@/lib/db'
import { signToken } from '@/lib/auth'

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ugyldig input' }, { status: 400 })
  }

  const { email, password } = parsed.data
  const db = getDb()

  const user = await db.prepare('SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?').get(email) as
    | { id: number; name: string; email: string; password_hash: string; created_at: string }
    | undefined

  if (!user) {
    return NextResponse.json({ error: 'Forkert email eller adgangskode' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Forkert email eller adgangskode' }, { status: 401 })
  }

  const token = signToken({ userId: user.id, email: user.email })
  const { password_hash: _, ...safeUser } = user

  const response = NextResponse.json({ user: safeUser, token })
  response.cookies.set('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
