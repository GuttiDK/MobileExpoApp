'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { api, SensorReading } from '@/lib/apiClient'

type Params = Promise<{ id: string; roomId: string }>

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

  const [readings, setReadings] = useState<SensorReading[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    try {
      const data = await api.rooms.history(rId, 100)
      setReadings(data.readings)
    } catch {
      router.replace(`/houses/${houseId}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [rId])

  const latest = readings[0] ?? null
  const stats = computeStats(readings)

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
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            {refreshing ? '⟳' : '↺ Opdater'}
          </button>
        </div>
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
                        {r.temperature != null ? (
                          <span className="text-red-400">{r.temperature.toFixed(1)}°C</span>
                        ) : <span className="text-slate-600">–</span>}
                      </td>
                      <td className="py-2">
                        {r.humidity != null ? (
                          <span className="text-cyan-400">{r.humidity.toFixed(0)}%</span>
                        ) : <span className="text-slate-600">–</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
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
