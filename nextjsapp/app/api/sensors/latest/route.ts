import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const db = getDb()
  const readings = db.prepare(`
    SELECT sr.room_id, r.name AS room_name, h.name AS house_name,
           sr.temperature, sr.humidity, sr.recorded_at
    FROM sensor_readings sr
    JOIN rooms r ON r.id = sr.room_id
    JOIN houses h ON h.id = r.house_id
    JOIN house_members hm ON hm.house_id = h.id AND hm.user_id = ?
    WHERE sr.id = (
      SELECT id FROM sensor_readings WHERE room_id = sr.room_id ORDER BY recorded_at DESC LIMIT 1
    )
    GROUP BY sr.room_id
  `).all(session.userId)

  return NextResponse.json({ readings })
}
