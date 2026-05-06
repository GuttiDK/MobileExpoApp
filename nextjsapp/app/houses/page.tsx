'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/authContext'
import { api, House } from '@/lib/apiClient'

const roleLabel: Record<string, string> = { owner: 'Ejer', member: 'Medlem', viewer: 'Seer' }
const roleColor: Record<string, string> = {
  owner: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

export default function HousesPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [houses, setHouses] = useState<House[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    try {
      const data = await api.houses.list()
      setHouses(data.houses)
    } catch {
      router.replace('/auth')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.houses.create(createName, createDesc || undefined)
      setShowCreate(false)
      setCreateName('')
      setCreateDesc('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.houses.join(joinCode)
      setShowJoin(false)
      setJoinCode('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    await logout()
    router.replace('/auth')
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
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-100">🏠 Mine huse</h1>
            <p className="text-sm text-slate-400">{user?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/devices')} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              📡 Enheder
            </button>
            {user?.is_admin ? (
              <button onClick={() => router.push('/admin')} className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
                🔧 Admin
              </button>
            ) : null}
            <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Log ud
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => { setShowCreate(true); setError('') }}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            + Opret hus
          </button>
          <button
            onClick={() => { setShowJoin(true); setError('') }}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold py-3 rounded-xl transition-colors"
          >
            Tilslut med kode
          </button>
        </div>

        {houses.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-5xl mb-4">🏚️</div>
            <p className="text-lg font-medium">Ingen huse endnu</p>
            <p className="text-sm mt-1">Opret et nyt hus eller tilslut med en invitationskode</p>
          </div>
        ) : (
          <div className="space-y-3">
            {houses.map(house => (
              <button
                key={house.id}
                onClick={() => router.push(`/houses/${house.id}`)}
                className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-2xl p-4 text-left transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-100">{house.name}</h2>
                    {house.description && <p className="text-sm text-slate-400 mt-0.5">{house.description}</p>}
                    <p className="text-xs text-slate-500 mt-1">{house.member_count} {house.member_count === 1 ? 'medlem' : 'medlemmer'}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full border ${roleColor[house.my_role]}`}>
                    {roleLabel[house.my_role]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Create modal */}
      {showCreate && (
        <Modal title="Opret nyt hus" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <InputField label="Navn" value={createName} onChange={setCreateName} placeholder="Mit hjem" required maxLength={100} />
            <InputField label="Beskrivelse (valgfri)" value={createDesc} onChange={setCreateDesc} placeholder="Beskrivelse..." maxLength={500} />
            {error && <ErrorMsg msg={error} />}
            <SubmitBtn label="Opret" loading={submitting} />
          </form>
        </Modal>
      )}

      {/* Join modal */}
      {showJoin && (
        <Modal title="Tilslut med kode" onClose={() => setShowJoin(false)}>
          <form onSubmit={handleJoin} className="space-y-4">
            <InputField label="Invitationskode" value={joinCode} onChange={setJoinCode} placeholder="ABC123" required maxLength={10} />
            {error && <ErrorMsg msg={error} />}
            <SubmitBtn label="Tilslut" loading={submitting} />
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function InputField({ label, value, onChange, placeholder, required, maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; maxLength?: number }) {
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
