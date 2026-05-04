import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { getAdminSession } from '@/lib/adminCheck'

export async function GET(request: NextRequest) {
  if (!(await getAdminSession(request))) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 })

  const db = getDb()
  const rooms = await db.prepare(`
    SELECT r.id, r.name, r.description, r.icon, r.mqtt_topic, r.house_id, r.created_at,
           h.name AS house_name
    FROM rooms r
    JOIN houses h ON h.id = r.house_id
    ORDER BY h.name ASC, r.name ASC
  `).all()

  return NextResponse.json({ rooms })
}
