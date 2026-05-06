import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { getZ2mDevices, getZ2mDeviceState, isZ2mBridgeOnline } from '@/lib/mqtt'

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const db = getDb()
  const dbRows = (await db
    .prepare(
      `SELECT d.ieee_address, d.room_id, r.name AS room_name, r.house_id
       FROM devices d
       LEFT JOIN rooms r ON r.id = d.room_id`,
    )
    .all()) as { ieee_address: string; room_id: number | null; room_name: string | null; house_id: number | null }[]

  const dbByIeee = new Map(dbRows.map((r) => [r.ieee_address, r]))

  const devices = getZ2mDevices()
    .filter((d) => d.type !== 'Coordinator')
    .map((d) => {
      const dbRow = dbByIeee.get(d.ieee_address)
      const state = getZ2mDeviceState(d.friendly_name)
      return {
        ieee_address: d.ieee_address,
        friendly_name: d.friendly_name,
        type: d.type,
        model: d.definition?.model ?? d.model_id ?? null,
        vendor: d.definition?.vendor ?? d.manufacturer ?? null,
        description: d.definition?.description ?? null,
        supported: d.supported ?? false,
        interview_completed: d.interview_completed ?? false,
        exposes: d.definition?.exposes ?? [],
        room_id: dbRow?.room_id ?? null,
        room_name: dbRow?.room_name ?? null,
        house_id: dbRow?.house_id ?? null,
        state: state?.payload ?? null,
        last_seen: state?.receivedAt ?? null,
      }
    })

  return NextResponse.json({
    bridge_online: isZ2mBridgeOnline(),
    devices,
  })
}
