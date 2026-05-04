'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { api, House, Member, Room } from '@/lib/apiClient'
import { useAuth } from '@/lib/authContext'

const ICONS = ['🏠', '🛋️', '🛏️', '🚿', '🍳', '🚗', '🌿', '📺', '💡', '❄️']

const roleLabel: Record<string, string> = { owner: 'Ejer', member: 'Medlem', viewer: 'Seer' }
const roleColor: Record<string, string> = {
  owner: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

type Tab = 'rooms' | 'members'

type Params = Promise<{ id: string }>

export default function HouseDetailPage({ params }: { params: Params }) {
  const { id } = use(params)
  const houseId = parseInt(id, 10)
  const router = useRouter()
  const { user } = useAuth()

  const [house, setHouse] = useState<House | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('rooms')

  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMemberOptions, setShowMemberOptions] = useState<Member | null>(null)

  const [roomName, setRoomName] = useState('')
  const [roomDesc, setRoomDesc] = useState('')
  const [roomIcon, setRoomIcon] = useState('🏠')
  const [roomTopic, setRoomTopic] = useState('')

  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [showEditHouse, setShowEditHouse] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    try {
      const data = await api.houses.get(houseId)
      setHouse(data.house)
      setMembers(data.members)
      setRooms(data.rooms)
    } catch {
      router.replace('/houses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [houseId])

  const isOwner = house?.my_role === 'owner'
  const canEdit = house?.my_role !== 'viewer'

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.rooms.create({ house_id: houseId, name: roomName, description: roomDesc || undefined, icon: roomIcon, mqtt_topic: roomTopic || undefined })
      setShowCreateRoom(false)
      setRoomName(''); setRoomDesc(''); setRoomIcon('🏠'); setRoomTopic('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteRoom(roomId: number) {
    if (!confirm('Slet dette rum?')) return
    try {
      await api.rooms.delete(roomId)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fejl')
    }
  }

  async function handleUpdateHouse(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.houses.update(houseId, { name: editName, description: editDesc })
      setShowEditHouse(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegenerateInvite() {
    if (!confirm('Generer ny invitationskode? Den gamle vil ikke virke mere.')) return
    try {
      await api.houses.regenerateInvite(houseId)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fejl')
    }
  }

  async function handleLeave() {
    if (!confirm('Er du sikker på at du vil forlade dette hus?')) return
    try {
      await api.houses.leave(houseId)
      router.replace('/houses')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fejl')
    }
  }

  async function handleDeleteHouse() {
    try {
      await api.houses.delete(houseId)
      router.replace('/houses')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fejl')
    }
  }

  async function handleMemberRole(memberId: number, role: 'member' | 'viewer') {
    try {
      await api.houses.updateMemberRole(houseId, memberId, role)
      setShowMemberOptions(null)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fejl')
    }
  }

  async function handleRemoveMember(memberId: number) {
    if (!confirm('Fjern dette medlem?')) return
    try {
      await api.houses.removeMember(houseId, memberId)
      setShowMemberOptions(null)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fejl')
    }
  }

  function formatTime(ts: string | null) {
    if (!ts) return 'Ingen data'
    const d = new Date(ts)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diff < 60) return 'Lige nu'
    if (diff < 3600) return `${Math.floor(diff / 60)} min siden`
    if (diff < 86400) return `${Math.floor(diff / 3600)} t siden`
    return d.toLocaleDateString('da-DK')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!house) return null

  return (
    <div className="min-h-screen">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => router.push('/houses')} className="text-slate-400 hover:text-slate-200">← Tilbage</button>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-100">{house.name}</h1>
              {house.description && <p className="text-sm text-slate-400">{house.description}</p>}
            </div>
            <button
              onClick={() => { setShowSettings(true); setError('') }}
              className="text-slate-400 hover:text-slate-200 text-xl"
            >
              ⚙️
            </button>
          </div>

          {/* Invite code banner */}
          <div
            className="mt-3 bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-2 flex items-center justify-between cursor-pointer"
            onClick={() => navigator.clipboard.writeText(house.invite_code)}
          >
            <span className="text-slate-400 text-sm">Invitationskode</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-blue-400">{house.invite_code}</span>
              <span className="text-slate-500 text-xs">📋</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-2xl mx-auto flex">
          {(['rooms', 'members'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${tab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              {t === 'rooms' ? '🏠 Rum' : '👥 Medlemmer'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {tab === 'rooms' && (
          <div>
            {canEdit && (
              <button
                onClick={() => { setShowCreateRoom(true); setError('') }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors mb-4"
              >
                + Tilføj rum
              </button>
            )}

            {rooms.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <div className="text-5xl mb-4">🚪</div>
                <p className="text-lg font-medium">Ingen rum endnu</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.map(room => (
                  <div key={room.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => router.push(`/houses/${houseId}/rooms/${room.id}`)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <span className="text-2xl">{room.icon}</span>
                        <div>
                          <h3 className="font-semibold text-slate-100">{room.name}</h3>
                          {room.description && <p className="text-sm text-slate-400">{room.description}</p>}
                          <div className="flex gap-3 mt-1">
                            {room.last_temperature != null && (
                              <span className="text-sm text-red-400">🌡️ {room.last_temperature.toFixed(1)}°C</span>
                            )}
                            {room.last_humidity != null && (
                              <span className="text-sm text-cyan-400">💧 {room.last_humidity.toFixed(0)}%</span>
                            )}
                            {room.last_reading_at && (
                              <span className="text-xs text-slate-500">{formatTime(room.last_reading_at)}</span>
                            )}
                          </div>
                        </div>
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors px-2 py-1"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'members' && (
          <div className="space-y-3">
            {members.map(member => (
              <div
                key={member.id}
                onClick={() => isOwner && member.id !== user?.id ? setShowMemberOptions(member) : null}
                className={`bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center gap-3 ${isOwner && member.id !== user?.id ? 'cursor-pointer hover:bg-slate-750' : ''}`}
              >
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-100">{member.name}</p>
                  <p className="text-sm text-slate-400">{member.email}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full border ${roleColor[member.role]}`}>
                  {roleLabel[member.role]}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create room modal */}
      {showCreateRoom && (
        <Modal title="Tilføj rum" onClose={() => setShowCreateRoom(false)}>
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Ikon</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setRoomIcon(icon)}
                    className={`text-2xl p-2 rounded-xl border ${roomIcon === icon ? 'border-blue-500 bg-blue-500/20' : 'border-slate-600 hover:border-slate-500'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <TextInput label="Navn" value={roomName} onChange={setRoomName} placeholder="Stue" required maxLength={100} />
            <TextInput label="Beskrivelse (valgfri)" value={roomDesc} onChange={setRoomDesc} placeholder="..." maxLength={500} />
            <TextInput label="MQTT emne (valgfri)" value={roomTopic} onChange={setRoomTopic} placeholder="home/stue/sensor" maxLength={256} />
            {error && <ErrorMsg msg={error} />}
            <SubmitBtn label="Opret rum" loading={submitting} />
          </form>
        </Modal>
      )}

      {/* Settings modal */}
      {showSettings && (
        <Modal title="Husindstillinger" onClose={() => { setShowSettings(false); setShowDeleteConfirm(false) }}>
          <div className="space-y-3">
            {isOwner && (
              <>
                <ActionBtn label="✏️ Rediger hus" onClick={() => { setEditName(house.name); setEditDesc(house.description ?? ''); setShowSettings(false); setShowEditHouse(true) }} />
                <ActionBtn label="🔑 Generer ny invitationskode" onClick={() => { setShowSettings(false); handleRegenerateInvite() }} />
              </>
            )}
            {!isOwner && (
              <ActionBtn label="🚪 Forlad hus" danger onClick={() => { setShowSettings(false); handleLeave() }} />
            )}
            {isOwner && !showDeleteConfirm && (
              <ActionBtn label="🗑️ Slet hus" danger onClick={() => setShowDeleteConfirm(true)} />
            )}
            {isOwner && showDeleteConfirm && (
              <div className="space-y-2">
                <p className="text-sm text-red-300">Er du sikker? Dette kan ikke fortrydes.</p>
                <ActionBtn label="Ja, slet hus" danger onClick={() => { setShowSettings(false); handleDeleteHouse() }} />
                <ActionBtn label="Annuller" onClick={() => setShowDeleteConfirm(false)} />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit house modal */}
      {showEditHouse && (
        <Modal title="Rediger hus" onClose={() => setShowEditHouse(false)}>
          <form onSubmit={handleUpdateHouse} className="space-y-4">
            <TextInput label="Navn" value={editName} onChange={setEditName} placeholder="Mit hjem" required maxLength={100} />
            <TextInput label="Beskrivelse (valgfri)" value={editDesc} onChange={setEditDesc} placeholder="..." maxLength={500} />
            {error && <ErrorMsg msg={error} />}
            <SubmitBtn label="Gem" loading={submitting} />
          </form>
        </Modal>
      )}

      {/* Member options modal */}
      {showMemberOptions && (
        <Modal title={showMemberOptions.name} onClose={() => setShowMemberOptions(null)}>
          <div className="space-y-3">
            <ActionBtn label="Sæt som Medlem" onClick={() => handleMemberRole(showMemberOptions.id, 'member')} />
            <ActionBtn label="Sæt som Seer" onClick={() => handleMemberRole(showMemberOptions.id, 'viewer')} />
            <ActionBtn label="🗑️ Fjern fra hus" danger onClick={() => handleRemoveMember(showMemberOptions.id)} />
          </div>
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
          <h2 className="font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function TextInput({ label, value, onChange, placeholder, required, maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; maxLength?: number }) {
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

function ActionBtn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full py-3 rounded-xl font-medium transition-colors ${danger ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800' : 'bg-slate-700 hover:bg-slate-600 text-slate-100'}`}
    >
      {label}
    </button>
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
