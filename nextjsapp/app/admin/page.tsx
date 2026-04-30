'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AdminUser {
  id: number
  name: string
  email: string
  is_admin: number
  created_at: string
}

interface AdminRoom {
  id: number
  name: string
  description: string | null
  icon: string
  mqtt_topic: string | null
  house_id: number
  house_name: string
}

type Tab = 'users' | 'rooms'

const ICONS = ['🏠', '🛋️', '🛏️', '🚿', '🍳', '🚗', '🌿', '📺', '💡', '❄️']

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [loading, setLoading] = useState(true)

  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const [editRoom, setEditRoom] = useState<AdminRoom | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editTopic, setEditTopic] = useState('')

  const [generateRoom, setGenerateRoom] = useState<AdminRoom | null>(null)
  const [genTemp, setGenTemp] = useState('')
  const [genHum, setGenHum] = useState('')
  const [genCount, setGenCount] = useState('1')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadAll() {
    const [uRes, rRes] = await Promise.all([
      fetch('/api/admin/users', { credentials: 'include' }),
      fetch('/api/admin/rooms', { credentials: 'include' }),
    ])
    if (uRes.status === 403 || uRes.status === 401) {
      router.replace('/houses')
      return
    }
    const [uData, rData] = await Promise.all([uRes.json(), rRes.json()])
    setUsers(uData.users ?? [])
    setRooms(rData.rooms ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  function flash(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}/password`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setResetTarget(null)
      setNewPassword('')
      flash(`Adgangskode nulstillet for ${resetTarget.name}`)
    } catch {
      setError('Noget gik galt')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditRoom(e: React.FormEvent) {
    e.preventDefault()
    if (!editRoom) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/rooms/${editRoom.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDesc || undefined,
          icon: editIcon,
          mqtt_topic: editTopic || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setEditRoom(null)
      await loadAll()
      flash(`Rum "${editName}" opdateret`)
    } catch {
      setError('Noget gik galt')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!generateRoom) return
    setError('')
    setSubmitting(true)
    try {
      const body: Record<string, number> = { count: parseInt(genCount) || 1 }
      if (genTemp !== '') body.temperature = parseFloat(genTemp)
      if (genHum !== '') body.humidity = parseFloat(genHum)

      const res = await fetch(`/api/admin/rooms/${generateRoom.id}/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setGenerateRoom(null)
      setGenTemp(''); setGenHum(''); setGenCount('1')
      flash(`${data.count} måling(er) genereret for "${generateRoom.name}"`)
    } catch {
      setError('Noget gik galt')
    } finally {
      setSubmitting(false)
    }
  }

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
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/houses')} className="text-slate-400 hover:text-slate-200">← Tilbage</button>
            <h1 className="text-lg font-bold text-slate-100">🔧 Admin</h1>
          </div>
          {success && (
            <span className="text-sm text-green-400 bg-green-900/30 border border-green-700 rounded-lg px-3 py-1">
              {success}
            </span>
          )}
        </div>
      </header>

      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-4xl mx-auto flex">
          {(['users', 'rooms'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${tab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              {t === 'users' ? `👥 Brugere (${users.length})` : `🏠 Rum (${rooms.length})`}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">

        {tab === 'users' && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  <th className="px-4 py-3">Navn</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Oprettet</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-medium text-slate-100">{u.name}</td>
                    <td className="px-4 py-3 text-slate-400">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.is_admin ? (
                        <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">Admin</span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString('da-DK')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setResetTarget(u); setNewPassword(''); setError('') }}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Nulstil adgangskode
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'rooms' && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  <th className="px-4 py-3">Rum</th>
                  <th className="px-4 py-3">Hus</th>
                  <th className="px-4 py-3">MQTT Emne</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {rooms.map(r => (
                  <tr key={r.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <span className="mr-2">{r.icon}</span>
                      <span className="font-medium text-slate-100">{r.name}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{r.house_name}</td>
                    <td className="px-4 py-3">
                      {r.mqtt_topic ? (
                        <span className="font-mono text-xs text-green-400">{r.mqtt_topic}</span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {r.mqtt_topic && (
                          <button
                            onClick={() => { setGenerateRoom(r); setGenTemp(''); setGenHum(''); setGenCount('1'); setError('') }}
                            className="text-xs bg-green-900/40 hover:bg-green-900/60 text-green-400 border border-green-700 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Generer data
                          </button>
                        )}
                        <button
                          onClick={() => { setEditRoom(r); setEditName(r.name); setEditDesc(r.description ?? ''); setEditIcon(r.icon); setEditTopic(r.mqtt_topic ?? ''); setError('') }}
                          className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Rediger
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Reset password modal */}
      {resetTarget && (
        <Modal title={`Nulstil adgangskode — ${resetTarget.name}`} onClose={() => setResetTarget(null)}>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Ny adgangskode</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 6 tegn"
                required
                minLength={6}
                maxLength={128}
                autoFocus
                className="w-full bg-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 border border-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            {error && <ErrorMsg msg={error} />}
            <SubmitBtn label="Nulstil adgangskode" loading={submitting} />
          </form>
        </Modal>
      )}

      {/* Edit room modal */}
      {editRoom && (
        <Modal title={`Rediger rum — ${editRoom.name}`} onClose={() => setEditRoom(null)}>
          <form onSubmit={handleEditRoom} className="space-y-4">
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

      {/* Generate data modal */}
      {generateRoom && (
        <Modal title={`Generer data — ${generateRoom.name}`} onClose={() => setGenerateRoom(null)}>
          <form onSubmit={handleGenerate} className="space-y-4">
            <p className="text-sm text-slate-400">
              Efterlad felterne tomme for at bruge tilfældige værdier (18–28°C, 40–70% fugt).
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
              <label className="block text-sm text-slate-400 mb-1">Antal målinger</label>
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
            <SubmitBtn label="Generer målinger" loading={submitting} />
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-100 text-sm">{title}</h2>
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
