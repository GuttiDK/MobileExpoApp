'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { api, SensorReading, Room, RoomDevice } from '@/lib/apiClient'
import { summarizeState } from '@/lib/deviceUtils'

type Params = Promise<{ id: string; roomId: string }>

const ICONS = ['🏠', '🛋️', '🛏️', '🚿', '🍳', '🚗', '🌿', '📺', '💡', '❄️']

interface RoomDetail extends Room {
  my_role: string
}

interface Stats {
  minTemp: number | null
  maxTemp: number | null
  avgTemp: number | null
  minHum: number | null
  maxHum: number | null
  avgHum: number | null
}

function computeStats(readings: SensorReading[]): Stats {
  const temps = readings.map(r => r.temperature).filter((t): t is number => t != null)
  const hums = readings.map(r => r.humidity).filter((h): h is number => h != null)
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  return {
    minTemp: temps.length ? Math.min(...temps) : null,
    maxTemp: temps.length ? Math.max(...temps) : null,
    avgTemp: avg(temps),
    minHum: hums.length ? Math.min(...hums) : null,
    maxHum: hums.length ? Math.max(...hums) : null,
    avgHum: avg(hums),
  }
}

function fmt(val: number | null, decimals = 1) {
  return val != null ? val.toFixed(decimals) : '–'
}

function formatDate(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('da-DK', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function RoomDetailPage({ params }: { params: Params }) {
  const { id, roomId } = use(params)
  const houseId = parseInt(id, 10)
  const rId = parseInt(roomId, 10)
  const router = useRouter()

  const [room, setRoom] = useState<RoomDetail | null>(null)
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editTopic, setEditTopic] = useState('')

  const [showGenerate, setShowGenerate] = useState(false)
  const [genTemp, setGenTemp] = useState('')
  const [genHum, setGenHum] = useState('')
  const [genCount, setGenCount] = useState('1')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [roomDevices, setRoomDevices] = useState<RoomDevice[]>([])
  const [availableDevices, setAvailableDevices] = useState<RoomDevice[]>([])
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [deviceBusy, setDeviceBusy] = useState<string | null>(null)

  async function loadDevices() {
    try {
      const data = await api.rooms.devices(rId)
      setRoomDevices(data.in_room)
      setAvailableDevices(data.available)
    } catch {
      // Ignore - devices section is optional
    }
  }

  async function attachDevice(ieee: string) {
    setDeviceBusy(ieee)
    setError('')
    try {
      await api.devices.update(ieee, { room_id: rId })
      await loadDevices()
      setShowAddDevice(false)
      flash('Enhed tilføjet')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setDeviceBusy(null)
    }
  }

  async function detachDevice(ieee: string) {
    setDeviceBusy(ieee)
    setError('')
    try {
      await api.devices.update(ieee, { room_id: null })
      await loadDevices()
      flash('Enhed fjernet fra rum')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setDeviceBusy(null)
    }
  }

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    try {
      const [roomData, historyData] = await Promise.all([
        api.rooms.get(rId),
        api.rooms.history(rId, 100),
      ])
      setRoom(roomData.room as RoomDetail)
      setReadings(historyData.readings)
    } catch {
      router.replace(`/houses/${houseId}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load(); loadDevices() }, [rId])

  function flash(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  function openEdit() {
    if (!room) return
    setEditName(room.name)
    setEditDesc(room.description ?? '')
    setEditIcon(room.icon)
    setEditTopic(room.mqtt_topic ?? '')
    setError('')
    setShowEdit(true)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.rooms.update(rId, {
        name: editName,
        description: editDesc || undefined,
        icon: editIcon,
        mqtt_topic: editTopic || null,
      })
      setShowEdit(false)
      await load()
      flash('Rum opdateret')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body: Record<string, number> = { count: parseInt(genCount) || 1 }
      if (genTemp !== '') body.temperature = parseFloat(genTemp)
      if (genHum !== '') body.humidity = parseFloat(genHum)

      const res = await fetch(`/api/rooms/${rId}/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowGenerate(false)
      setGenTemp(''); setGenHum(''); setGenCount('1')
      await load(true)
      flash(`${data.count} måling(er) genereret`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setSubmitting(false)
    }
  }

  const latest = readings[0] ?? null
  const stats = computeStats(readings)
  const canEdit = room?.my_role !== 'viewer'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push(`/houses/${houseId}`)} className="text-slate-400 hover:text-slate-200">
            ← Tilbage
          </button>
          <div className="flex items-center gap-2">
            {success && (
              <span className="text-xs text-green-400 bg-green-900/30 border border-green-700 rounded-lg px-2 py-1">
                {success}
              </span>
            )}
            {room?.mqtt_topic && canEdit && (
              <button
                onClick={() => { setGenTemp(''); setGenHum(''); setGenCount('1'); setError(''); setShowGenerate(true) }}
                className="text-sm text-green-400 hover:text-green-300 border border-green-700 bg-green-900/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                Generer data
              </button>
            )}
            {canEdit && (
              <button
                onClick={openEdit}
                className="text-sm text-slate-400 hover:text-slate-200 border border-slate-600 px-3 py-1.5 rounded-lg transition-colors"
              >
                Rediger
              </button>
            )}
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              {refreshing ? '⟳' : '↺'}
            </button>
          </div>
        </div>
        {room && (
          <div className="max-w-2xl mx-auto mt-2">
            <h1 className="text-base font-semibold text-slate-100">
              {room.icon} {room.name}
            </h1>
            {room.description && <p className="text-sm text-slate-400">{room.description}</p>}
            {room.mqtt_topic && (
              <p className="text-xs text-slate-500 font-mono mt-0.5">{room.mqtt_topic}</p>
            )}
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Live data */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="text-sm text-slate-400 mb-4 font-medium">Seneste måling</h2>
          {latest ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-red-400">{fmt(latest.temperature)}°C</div>
                <div className="text-sm text-slate-400 mt-1">Temperatur</div>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-cyan-400">{fmt(latest.humidity, 0)}%</div>
                <div className="text-sm text-slate-400 mt-1">Luftfugtighed</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <div className="text-4xl mb-2">📡</div>
              <p>Venter på sensordata...</p>
            </div>
          )}
          {latest && (
            <p className="text-xs text-slate-500 text-center mt-3">{formatDate(latest.recorded_at)}</p>
          )}
        </div>

        {/* Devices in room */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm text-slate-400 font-medium">Enheder ({roomDevices.length})</h2>
            {canEdit && (
              <button
                onClick={() => { setShowAddDevice(true); setError('') }}
                className="text-sm text-blue-400 hover:text-blue-300 border border-blue-700 bg-blue-900/20 px-3 py-1.5 rounded-lg"
              >
                + Tilføj
              </button>
            )}
          </div>
          {roomDevices.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              <p>Ingen enheder tilknyttet</p>
              {canEdit && <p className="mt-1 text-xs">Tryk "Tilføj" for at vælge fra dine zigbee-enheder</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {roomDevices.map((d) => (
                <div key={d.ieee_address} className="flex items-center justify-between bg-slate-700/50 border border-slate-600 rounded-xl p-3">
                  <button
                    onClick={() => router.push(`/devices/${encodeURIComponent(d.ieee_address)}`)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="font-medium text-slate-100 truncate">{d.friendly_name}</p>
                    <p className="text-xs text-slate-400 truncate">{summarizeState(d)}</p>
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => detachDevice(d.ieee_address)}
                      disabled={deviceBusy === d.ieee_address}
                      className="ml-3 text-xs text-slate-400 hover:text-red-400 disabled:opacity-50"
                    >
                      Fjern
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        {readings.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h2 className="text-sm text-slate-400 mb-4 font-medium">Statistik (seneste {readings.length} målinger)</h2>
            <div className="grid grid-cols-3 gap-2">
              <StatBox label="Min temp" value={`${fmt(stats.minTemp)}°`} color="text-blue-400" />
              <StatBox label="Gns temp" value={`${fmt(stats.avgTemp)}°`} color="text-red-400" />
              <StatBox label="Maks temp" value={`${fmt(stats.maxTemp)}°`} color="text-orange-400" />
              <StatBox label="Min fugt" value={`${fmt(stats.minHum, 0)}%`} color="text-blue-300" />
              <StatBox label="Gns fugt" value={`${fmt(stats.avgHum, 0)}%`} color="text-cyan-400" />
              <StatBox label="Maks fugt" value={`${fmt(stats.maxHum, 0)}%`} color="text-teal-400" />
            </div>
          </div>
        )}

        {/* History table */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="text-sm text-slate-400 mb-4 font-medium">Historik</h2>
          {readings.length === 0 ? (
            <div className="text-center py-8 text-slate-500">Ingen data endnu</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-left border-b border-slate-700">
                    <th className="pb-2">Tidspunkt</th>
                    <th className="pb-2">Temp</th>
                    <th className="pb-2">Fugt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {readings.map(r => (
                    <tr key={r.id}>
                      <td className="py-2 text-slate-400">{formatDate(r.recorded_at)}</td>
                      <td className="py-2">
                        {r.temperature != null
                          ? <span className="text-red-400">{r.temperature.toFixed(1)}°C</span>
                          : <span className="text-slate-600">–</span>}
                      </td>
                      <td className="py-2">
                        {r.humidity != null
                          ? <span className="text-cyan-400">{r.humidity.toFixed(0)}%</span>
                          : <span className="text-slate-600">–</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Edit modal */}
      {showEdit && (
        <Modal title="Rediger rum" onClose={() => setShowEdit(false)}>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Ikon</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setEditIcon(icon)}
                    className={`text-2xl p-2 rounded-xl border ${editIcon === icon ? 'border-blue-500 bg-blue-500/20' : 'border-slate-600 hover:border-slate-500'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Navn" value={editName} onChange={setEditName} required maxLength={100} />
            <Field label="Beskrivelse (valgfri)" value={editDesc} onChange={setEditDesc} maxLength={500} />
            <Field label="MQTT Emne (valgfri)" value={editTopic} onChange={setEditTopic} placeholder="home/stue/sensor" maxLength={256} />
            {error && <ErrorMsg msg={error} />}
            <SubmitBtn label="Gem ændringer" loading={submitting} />
          </form>
        </Modal>
      )}

      {/* Add device modal */}
      {showAddDevice && (
        <Modal title="Tilføj enhed til rum" onClose={() => setShowAddDevice(false)}>
          {availableDevices.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm">Ingen tilgængelige enheder</p>
              <button
                onClick={() => router.push('/devices')}
                className="mt-3 text-sm text-blue-400 hover:text-blue-300"
              >
                Gå til Enheder for at parre nye →
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableDevices.map((d) => (
                <button
                  key={d.ieee_address}
                  onClick={() => attachDevice(d.ieee_address)}
                  disabled={deviceBusy === d.ieee_address}
                  className="w-full text-left bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-xl p-3 disabled:opacity-50"
                >
                  <p className="font-medium text-slate-100 truncate">{d.friendly_name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {d.vendor ?? '?'} · {d.model ?? d.ieee_address}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Generate data modal */}
      {showGenerate && (
        <Modal title="Generer sensordata" onClose={() => setShowGenerate(false)}>
          <form onSubmit={handleGenerate} className="space-y-4">
            <p className="text-sm text-slate-400">
              Efterlad felterne tomme for tilfældige værdier (18–28°C, 40–70%).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Temperatur (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={genTemp}
                  onChange={e => setGenTemp(e.target.value)}
                  placeholder="Tilfældig"
                  className="w-full bg-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 border border-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Luftfugtighed (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={genHum}
                  onChange={e => setGenHum(e.target.value)}
                  placeholder="Tilfældig"
                  className="w-full bg-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 border border-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Antal målinger (max 50)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={genCount}
                onChange={e => setGenCount(e.target.value)}
                className="w-full bg-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 border border-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            {error && <ErrorMsg msg={error} />}
            <SubmitBtn label="Generer" loading={submitting} />
          </form>
        </Modal>
      )}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-3 text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, required, maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; maxLength?: number }) {
  return (
    <div>
      <label className="block text-sm text-slate-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        className="w-full bg-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 border border-slate-600 focus:outline-none focus:border-blue-500"
      />
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{msg}</div>
}

function SubmitBtn({ label, loading }: { label: string; loading: boolean }) {
  return (
    <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
      {loading ? 'Indlæser...' : label}
    </button>
  )
}
