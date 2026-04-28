export interface User {
  id: number
  name: string
  email: string
  created_at: string
}

export interface House {
  id: number
  name: string
  description: string | null
  owner_id: number
  owner_name: string
  invite_code: string
  my_role: 'owner' | 'member' | 'viewer'
  member_count: number
  created_at: string
}

export interface Member {
  id: number
  name: string
  email: string
  role: 'owner' | 'member' | 'viewer'
  joined_at: string
}

export interface Room {
  id: number
  house_id: number
  name: string
  description: string | null
  icon: string
  mqtt_topic: string | null
  last_temperature: number | null
  last_humidity: number | null
  last_reading_at: string | null
  created_at: string
}

export interface SensorReading {
  id: number
  room_id: number
  temperature: number | null
  humidity: number | null
  recorded_at: string
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

export const api = {
  auth: {
    register: (name: string, email: string, password: string) =>
      apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
    login: (email: string, password: string) =>
      apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
    me: () => apiFetch('/api/auth/me'),
  },
  houses: {
    list: (): Promise<{ houses: House[] }> => apiFetch('/api/houses'),
    get: (id: number): Promise<{ house: House; members: Member[]; rooms: Room[] }> => apiFetch(`/api/houses/${id}`),
    create: (name: string, description?: string): Promise<{ house: House }> =>
      apiFetch('/api/houses', { method: 'POST', body: JSON.stringify({ name, description }) }),
    update: (id: number, data: { name?: string; description?: string }): Promise<{ house: House }> =>
      apiFetch(`/api/houses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch(`/api/houses/${id}`, { method: 'DELETE' }),
    join: (invite_code: string) => apiFetch('/api/houses/join', { method: 'POST', body: JSON.stringify({ invite_code }) }),
    leave: (id: number) => apiFetch(`/api/houses/${id}/leave`, { method: 'DELETE' }),
    regenerateInvite: (id: number): Promise<{ invite_code: string }> =>
      apiFetch(`/api/houses/${id}/regenerate-invite`, { method: 'POST' }),
    updateMemberRole: (houseId: number, userId: number, role: 'member' | 'viewer') =>
      apiFetch(`/api/houses/${houseId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    removeMember: (houseId: number, userId: number) =>
      apiFetch(`/api/houses/${houseId}/members/${userId}`, { method: 'DELETE' }),
  },
  rooms: {
    create: (data: { house_id: number; name: string; description?: string; icon?: string; mqtt_topic?: string }): Promise<{ room: Room }> =>
      apiFetch('/api/rooms', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; description?: string; icon?: string; mqtt_topic?: string }): Promise<{ room: Room }> =>
      apiFetch(`/api/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch(`/api/rooms/${id}`, { method: 'DELETE' }),
    history: (id: number, limit?: number): Promise<{ readings: SensorReading[] }> =>
      apiFetch(`/api/rooms/${id}/history?limit=${limit ?? 100}`),
  },
  sensors: {
    latest: () => apiFetch('/api/sensors/latest'),
    post: (roomId: number, data: { temperature?: number; humidity?: number }) =>
      apiFetch(`/api/sensors/${roomId}`, { method: 'POST', body: JSON.stringify(data) }),
  },
}
