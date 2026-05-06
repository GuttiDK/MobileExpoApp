import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getZ2mDevice, publishZ2m, type Z2mExpose } from '@/lib/mqtt'

type Params = Promise<{ ieee: string }>

const ACCESS_SET = 0b010

function collectSettableProperties(exposes: Z2mExpose[] | undefined, out = new Set<string>()): Set<string> {
  if (!exposes) return out
  for (const ex of exposes) {
    const access = typeof ex.access === 'number' ? ex.access : 0
    const prop = (ex.property as string | undefined) ?? (ex.name as string | undefined)
    if (prop && (access & ACCESS_SET) === ACCESS_SET) out.add(prop)
    if (ex.features) collectSettableProperties(ex.features, out)
  }
  return out
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })

  const { ieee } = await params
  const dev = getZ2mDevice(ieee)
  if (!dev) return NextResponse.json({ error: 'Device ikke fundet' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Ugyldig body' }, { status: 400 })
  }

  const settable = collectSettableProperties(dev.definition?.exposes)
  const payload: Record<string, unknown> = {}
  const rejected: string[] = []

  for (const [key, value] of Object.entries(body)) {
    if (settable.has(key)) payload[key] = value
    else rejected.push(key)
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json(
      { error: 'Ingen gyldige properties at sætte', rejected, settable: Array.from(settable) },
      { status: 400 },
    )
  }

  const ok = publishZ2m(`${dev.friendly_name}/set`, payload)
  if (!ok) return NextResponse.json({ error: 'MQTT ikke tilsluttet' }, { status: 503 })

  return NextResponse.json({ ok: true, sent: payload, rejected: rejected.length ? rejected : undefined })
}
