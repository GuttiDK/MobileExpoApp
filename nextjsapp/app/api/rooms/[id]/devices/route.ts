import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { getZ2mDevices, getZ2mDeviceState } from '@/lib/mqtt'

type Params = Promise<{ id: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { id } = await params
  const roomId = parseInt(id, 10)
  if (!Number.isFinite(roomId)) return NextResponse.json({ error: 'Ugyldigt id' }, { status: 400 })

  const db = getDb()
  const room = (await db
    .prepare(
      `SELECT r.id, r.house_id, hm.role
       FROM rooms r JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ?
       WHERE r.id = ?`,
    )
    .get(session.userId, roomId)) as { id: number; house_id: number; role: string } | undefined
  if (!room) return NextResponse.json({ error: 'Rum ikke fundet' }, { status: 404 })

  const dbDevices = (await db
    .prepare(
      `SELECT d.ieee_address, d.room_id, r2.house_id AS device_house_id
       FROM devices d LEFT JOIN rooms r2 ON r2.id = d.room_id`,
    )
    .all()) as { ieee_address: string; room_id: number | null; device_house_id: number | null }[]

  const dbByIeee = new Map(dbDevices.map((r) => [r.ieee_address, r]))

  const enrich = (ieee: string, friendly_name: string, type: string | null, model: string | null, vendor: string | null) => {
    const state = getZ2mDeviceState(friendly_name)
    return {
      ieee_address: ieee,
      friendly_name,
      type,
      model,
      vendor,
      state: state?.payload ?? null,
      last_seen: state?.receivedAt ?? null,
    }
  }

  const z2mList = getZ2mDevices().filter((d) => d.type !== 'Coordinator')

  const inRoom = z2mList
    .filter((d) => dbByIeee.get(d.ieee_address)?.room_id === roomId)
    .map((d) =>
      enrich(
        d.ieee_address,
        d.friendly_name,
        d.type ?? null,
        d.definition?.model ?? d.model_id ?? null,
        d.definition?.vendor ?? d.manufacturer ?? null,
      ),
    )

  // Available = devices not assigned to any room, or assigned to a room in the
  // same house but not this one. Filtering by same house keeps the picker
  // scoped — devices in another house shouldn't appear.
  const available = z2mList
    .filter((d) => {
      const row = dbByIeee.get(d.ieee_address)
      if (!row) return true
      if (row.room_id === roomId) return false
      if (row.room_id === null) return true
      return row.device_house_id === room.house_id
    })
    .map((d) =>
      enrich(
        d.ieee_address,
        d.friendly_name,
        d.type ?? null,
        d.definition?.model ?? d.model_id ?? null,
        d.definition?.vendor ?? d.manufacturer ?? null,
      ),
    )

  return NextResponse.json({ in_room: inRoom, available, can_edit: room.role !== 'viewer' })
}
