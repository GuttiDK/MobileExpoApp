import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import getDb from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { getZ2mDevice, getZ2mDeviceState, publishZ2m } from '@/lib/mqtt'

type Params = Promise<{ ieee: string }>

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { ieee } = await params
  const dev = getZ2mDevice(ieee)
  if (!dev) return NextResponse.json({ error: 'Device ikke fundet' }, { status: 404 })

  const db = getDb()
  const dbRow = (await db
    .prepare(
      `SELECT d.room_id, r.name AS room_name, r.house_id
       FROM devices d LEFT JOIN rooms r ON r.id = d.room_id
       WHERE d.ieee_address = ?`,
    )
    .get(dev.ieee_address)) as { room_id: number | null; room_name: string | null; house_id: number | null } | undefined

  const state = getZ2mDeviceState(dev.friendly_name)

  return NextResponse.json({
    device: {
      ieee_address: dev.ieee_address,
      friendly_name: dev.friendly_name,
      type: dev.type,
      model: dev.definition?.model ?? dev.model_id ?? null,
      vendor: dev.definition?.vendor ?? dev.manufacturer ?? null,
      description: dev.definition?.description ?? null,
      supported: dev.supported ?? false,
      interview_completed: dev.interview_completed ?? false,
      exposes: dev.definition?.exposes ?? [],
      room_id: dbRow?.room_id ?? null,
      room_name: dbRow?.room_name ?? null,
      house_id: dbRow?.house_id ?? null,
      state: state?.payload ?? null,
      last_seen: state?.receivedAt ?? null,
    },
  })
}

const patchSchema = z.object({
  room_id: z.number().int().positive().nullable().optional(),
  friendly_name: z.string().min(1).max(100).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { ieee } = await params
  const dev = getZ2mDevice(ieee)
  if (!dev) return NextResponse.json({ error: 'Device ikke fundet' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ugyldig input' }, { status: 400 })

  const db = getDb()

  if (parsed.data.room_id !== undefined) {
    if (parsed.data.room_id !== null) {
      const room = (await db
        .prepare(
          'SELECT hm.role FROM rooms r JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ? WHERE r.id = ?',
        )
        .get(session.userId, parsed.data.room_id)) as { role: string } | undefined
      if (!room) return NextResponse.json({ error: 'Ingen adgang til rum' }, { status: 403 })
      if (room.role === 'viewer') return NextResponse.json({ error: 'Ingen skriveadgang' }, { status: 403 })
    }

    await db
      .prepare(
        `INSERT INTO devices (ieee_address, friendly_name, type, model, vendor, description, supported, exposes, room_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)
         ON CONFLICT (ieee_address) DO UPDATE SET room_id = EXCLUDED.room_id`,
      )
      .run(
        dev.ieee_address,
        dev.friendly_name,
        dev.type ?? null,
        dev.definition?.model ?? dev.model_id ?? null,
        dev.definition?.vendor ?? dev.manufacturer ?? null,
        dev.definition?.description ?? null,
        dev.supported ?? false,
        JSON.stringify(dev.definition?.exposes ?? []),
        parsed.data.room_id,
      )
  }

  if (parsed.data.friendly_name && parsed.data.friendly_name !== dev.friendly_name) {
    if (parsed.data.friendly_name.includes('/')) {
      return NextResponse.json({ error: 'Friendly name må ikke indeholde /' }, { status: 400 })
    }
    const ok = publishZ2m('bridge/request/device/rename', {
      from: dev.friendly_name,
      to: parsed.data.friendly_name,
    })
    if (!ok) return NextResponse.json({ error: 'MQTT ikke tilsluttet' }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { ieee } = await params
  const dev = getZ2mDevice(ieee)
  if (!dev) return NextResponse.json({ error: 'Device ikke fundet' }, { status: 404 })

  const force = new URL(request.url).searchParams.get('force') === 'true'
  const ok = publishZ2m('bridge/request/device/remove', {
    id: dev.friendly_name,
    force,
  })
  if (!ok) return NextResponse.json({ error: 'MQTT ikke tilsluttet' }, { status: 503 })

  const db = getDb()
  await db.prepare('DELETE FROM devices WHERE ieee_address = ?').run(dev.ieee_address)

  return NextResponse.json({ ok: true })
}
