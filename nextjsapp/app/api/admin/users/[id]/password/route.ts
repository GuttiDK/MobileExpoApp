import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getAdminSession } from '@/lib/adminCheck'

type Params = Promise<{ id: string }>

const schema = z.object({
  password: z.string().min(6).max(128),
})

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  if (!(await getAdminSession(request))) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const { id } = await params
  const userId = parseInt(id, 10)

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Adgangskode skal være mindst 6 tegn' }, { status: 400 })

  const db = getDb()
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!user) return NextResponse.json({ error: 'Bruger ikke fundet' }, { status: 404 })

  const hash = await bcrypt.hash(parsed.data.password, 10)
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId)

  return NextResponse.json({ ok: true })
}
