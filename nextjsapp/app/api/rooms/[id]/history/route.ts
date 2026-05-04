import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

type Params = Promise<{ id: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const roomId = parseInt(id, 10)
  const { searchParams } = new URL(request.url)
  const limit = Math.min(500, Math.max(50, parseInt(searchParams.get('limit') ?? '100', 10)))

  const db = getDb()

  const room = await db.prepare(
    'SELECT r.id FROM rooms r JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ? WHERE r.id = ?'
  ).get(session.userId, roomId)

  if (!room) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 })

  const readings = await db.prepare(
    'SELECT id, temperature, humidity, recorded_at FROM sensor_readings WHERE room_id = ? ORDER BY recorded_at DESC LIMIT ?'
  ).all(roomId, limit)

  return NextResponse.json({ readings })
}
