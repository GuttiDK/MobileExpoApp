'use client'

import { useEffect, useRef, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { api, Device, Z2mExpose } from '@/lib/apiClient'
import { findExpose, flattenExposes, isDeviceOnline, isSettable } from '@/lib/deviceUtils'

type Params = Promise<{ ieee: string }>

export default function DeviceDetailPage({ params }: { params: Params }) {
  const { ieee } = use(params)
  const decodedIeee = decodeURIComponent(ieee)
  const router = useRouter()
  const [device, setDevice] = useState<Device | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const evtRef = useRef<EventSource | null>(null)

  async function load() {
    try {
      const data = await api.devices.get(decodedIeee)
      setDevice(data.device)
    } catch (err) {
      if (err instanceof Error && err.message.includes('Ikke logget')) {
        router.replace('/auth')
        return
      }
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const evt = new EventSource('/api/devices/stream', { withCredentials: true })
    evt.addEventListener('state', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as {
          ieee_address: string
          state: Record<string, unknown>
          receivedAt: string
        }
        if (data.ieee_address === decodedIeee) {
          setDevice((d) => (d ? { ...d, state: data.state, last_seen: data.receivedAt } : d))
        }
      } catch {
        // Ignore
      }
    })
    evtRef.current = evt
    return () => evt.close()
  }, [decodedIeee])

  async function setProp(prop: string, value: unknown) {
    if (!device) return
    setPending(true)
    setError('')
    setDevice({ ...device, state: { ...(device.state ?? {}), [prop]: value } })
    try {
      await api.devices.set(device.ieee_address, { [prop]: value })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
      load()
    } finally {
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!device) return
    setPending(true)
    try {
      await api.devices.remove(device.ieee_address)
      router.replace('/devices')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
      setPending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!device) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <p className="text-slate-300 mb-4">Enhed ikke fundet</p>
        <button onClick={() => router.push('/devices')} className="text-blue-400">← Tilbage til enheder</button>
      </div>
    )
  }

  const flat = flattenExposes(device.exposes)
  const online = isDeviceOnline(device)

  return (
    <div className="min-h-screen">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-slate-500'}`} />
              <h1 className="text-lg font-bold text-slate-100 truncate">{device.friendly_name}</h1>
            </div>
            <p className="text-xs text-slate-500 truncate">
              {device.vendor ?? '?'} · {device.model ?? '?'} · {device.ieee_address}
            </p>
          </div>
          <button onClick={() => router.push('/devices')} className="text-sm text-slate-400 hover:text-slate-200 ml-3">
            ← Tilbage
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
        )}

        <div className="space-y-3">
          {flat
            .filter((ex) => (ex.property ?? ex.name) && !ex.features)
            .map((ex) => (
              <ExposeControl
                key={(ex.property ?? ex.name) as string}
                expose={ex}
                device={device}
                onSet={setProp}
                disabled={pending || !online}
              />
            ))}
        </div>

        {device.room_name && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-300">
            Tilknyttet rum: <span className="text-blue-400">{device.room_name}</span>
          </div>
        )}

        <div className="pt-4">
          {confirmDelete ? (
            <div className="bg-red-900/40 border border-red-700 rounded-xl p-4">
              <p className="text-red-300 text-sm mb-3">Fjern enheden permanent fra zigbee-netværket?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={pending}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg"
                >
                  Bekræft fjern
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={pending}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 rounded-lg"
                >
                  Annuller
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full text-red-400 hover:text-red-300 text-sm py-2"
            >
              Fjern enhed
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

function ExposeControl({
  expose,
  device,
  onSet,
  disabled,
}: {
  expose: Z2mExpose
  device: Device
  onSet: (prop: string, value: unknown) => void
  disabled: boolean
}) {
  const prop = (expose.property ?? expose.name) as string
  const settable = isSettable(expose)
  const state = device.state ?? {}
  const value = state[prop]
  const label = expose.name ?? prop

  if (expose.type === 'binary') {
    const on = value === (expose.value_on ?? 'ON') || value === true
    if (settable) {
      return (
        <Card title={label}>
          <button
            onClick={() => onSet(prop, on ? (expose.value_off ?? 'OFF') : (expose.value_on ?? 'ON'))}
            disabled={disabled}
            className={`w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 ${
              on ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            {on ? '● Tændt' : '○ Slukket'}
          </button>
        </Card>
      )
    }
    return (
      <Card title={label}>
        <p className="text-slate-300">{prop === 'contact' ? (value ? '🚪 Lukket' : '🚪 Åben') : on ? 'Aktiv' : 'Inaktiv'}</p>
      </Card>
    )
  }

  if (expose.type === 'numeric') {
    const num = typeof value === 'number' ? value : null
    if (settable && typeof expose.value_min === 'number' && typeof expose.value_max === 'number') {
      return (
        <Card title={label}>
          <input
            type="range"
            min={expose.value_min}
            max={expose.value_max}
            step={expose.value_step ?? 1}
            value={num ?? expose.value_min}
            disabled={disabled}
            onChange={(e) => onSet(prop, Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <p className="text-sm text-slate-400 mt-1">
            {num ?? '—'}
            {expose.unit ?? ''}
          </p>
        </Card>
      )
    }
    return (
      <Card title={label}>
        <p className="text-slate-100 text-2xl font-semibold">
          {num !== null ? `${num}${expose.unit ?? ''}` : '—'}
        </p>
      </Card>
    )
  }

  if (expose.type === 'enum' && settable && Array.isArray(expose.values)) {
    return (
      <Card title={label}>
        <select
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(e) => onSet(prop, e.target.value)}
          className="w-full bg-slate-700 rounded-xl px-3 py-2 text-slate-100 border border-slate-600 focus:outline-none focus:border-blue-500"
        >
          <option value="" disabled>Vælg...</option>
          {(expose.values as string[]).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </Card>
    )
  }

  if (prop === 'color' && settable) {
    return <ColorControl device={device} onSet={onSet} disabled={disabled} />
  }

  return (
    <Card title={label}>
      <p className="text-slate-400 text-sm">{value !== undefined ? JSON.stringify(value) : '—'}</p>
    </Card>
  )
}

function ColorControl({
  device,
  onSet,
  disabled,
}: {
  device: Device
  onSet: (prop: string, value: unknown) => void
  disabled: boolean
}) {
  const colorState = device.state?.color as { x?: number; y?: number; hex?: string } | undefined
  const initial = colorState?.hex ?? '#ffffff'
  const colorTempExpose = findExpose(device, 'color_temp')
  const ct = typeof device.state?.color_temp === 'number' ? device.state.color_temp : null

  return (
    <Card title="Farve">
      <div className="flex items-center gap-3">
        <input
          type="color"
          defaultValue={initial}
          disabled={disabled}
          onChange={(e) => onSet('color', { hex: e.target.value })}
          className="w-16 h-12 rounded-lg cursor-pointer disabled:opacity-50"
        />
        <p className="text-sm text-slate-400">Vælg farve</p>
      </div>
      {colorTempExpose && (
        <div className="mt-4">
          <p className="text-xs text-slate-400 mb-1">Farvetemperatur</p>
          <input
            type="range"
            min={colorTempExpose.value_min ?? 150}
            max={colorTempExpose.value_max ?? 500}
            value={ct ?? colorTempExpose.value_min ?? 250}
            disabled={disabled}
            onChange={(e) => onSet('color_temp', Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>
      )}
    </Card>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  )
}
