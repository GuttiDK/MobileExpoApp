'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, Device } from '@/lib/apiClient'
import {
  categorize,
  categoryIcon,
  categoryLabel,
  isDeviceOnline,
  summarizeState,
  type DeviceCategory,
} from '@/lib/deviceUtils'

const CATEGORY_ORDER: DeviceCategory[] = ['light', 'switch', 'contact', 'sensor', 'climate', 'other']

export default function DevicesPage() {
  const router = useRouter()
  const [devices, setDevices] = useState<Device[]>([])
  const [bridgeOnline, setBridgeOnline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pairing, setPairing] = useState(false)
  const [pairCountdown, setPairCountdown] = useState(0)
  const pairTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function load() {
    try {
      const data = await api.devices.list()
      setDevices(data.devices)
      setBridgeOnline(data.bridge_online)
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
        setDevices((prev) =>
          prev.map((d) =>
            d.ieee_address === data.ieee_address
              ? { ...d, state: data.state, last_seen: data.receivedAt }
              : d,
          ),
        )
      } catch {
        // Ignore parse errors
      }
    })
    return () => {
      evt.close()
      if (pairTimer.current) clearInterval(pairTimer.current)
    }
  }, [])

  async function togglePair() {
    setError('')
    try {
      if (!pairing) {
        await api.devices.permitJoin(true, 254)
        setPairing(true)
        setPairCountdown(254)
        pairTimer.current = setInterval(() => {
          setPairCountdown((c) => {
            if (c <= 1) {
              if (pairTimer.current) clearInterval(pairTimer.current)
              setPairing(false)
              load()
              return 0
            }
            return c - 1
          })
        }, 1000)
      } else {
        await api.devices.permitJoin(false)
        if (pairTimer.current) clearInterval(pairTimer.current)
        setPairing(false)
        setPairCountdown(0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const grouped = new Map<DeviceCategory, Device[]>()
  for (const d of devices) {
    const cat = categorize(d)
    const arr = grouped.get(cat) ?? []
    arr.push(d)
    grouped.set(cat, arr)
  }

  return (
    <div className="min-h-screen">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-100">📡 Enheder</h1>
            <p className="text-sm text-slate-400">
              {bridgeOnline ? (
                <span className="text-green-400">Bridge online</span>
              ) : (
                <span className="text-red-400">Bridge offline</span>
              )}
              {' · '}
              {devices.length} {devices.length === 1 ? 'enhed' : 'enheder'}
            </p>
          </div>
          <button
            onClick={() => router.push('/houses')}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Tilbage
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={togglePair}
          disabled={!bridgeOnline}
          className={`w-full font-semibold py-3 rounded-xl transition-colors mb-6 disabled:opacity-50 ${
            pairing
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {pairing ? `Stop parring (${pairCountdown}s)` : '+ Tilføj enhed'}
        </button>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        {devices.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-lg font-medium">Ingen enheder endnu</p>
            <p className="text-sm mt-1">Tryk "Tilføj enhed" og sæt din zigbee-enhed i parringsmode</p>
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => (
              <section key={cat}>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span>{categoryIcon[cat]}</span>
                  <span>{categoryLabel[cat]}</span>
                </h2>
                <div className="space-y-2">
                  {grouped.get(cat)!.map((d) => (
                    <DeviceCard key={d.ieee_address} device={d} onClick={() => router.push(`/devices/${encodeURIComponent(d.ieee_address)}`)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function DeviceCard({ device, onClick }: { device: Device; onClick: () => void }) {
  const online = isDeviceOnline(device)
  return (
    <button
      onClick={onClick}
      className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-2xl p-4 text-left transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-slate-500'}`} />
            <h3 className="font-semibold text-slate-100 truncate">{device.friendly_name}</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {device.vendor ?? '?'} · {device.model ?? device.ieee_address}
          </p>
          <p className="text-sm text-slate-300 mt-1 truncate">{summarizeState(device)}</p>
          {device.room_name && (
            <p className="text-xs text-blue-400 mt-1">{device.room_name}</p>
          )}
        </div>
      </div>
    </button>
  )
}
