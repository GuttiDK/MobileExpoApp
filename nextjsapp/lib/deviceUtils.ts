import type { Device, Z2mExpose } from './apiClient'

export type DeviceCategory = 'light' | 'switch' | 'sensor' | 'contact' | 'climate' | 'other'

const ACCESS_SET = 0b010

export function flattenExposes(exposes: Z2mExpose[] | undefined, out: Z2mExpose[] = []): Z2mExpose[] {
  if (!exposes) return out
  for (const ex of exposes) {
    out.push(ex)
    if (ex.features) flattenExposes(ex.features, out)
  }
  return out
}

export function findExpose(device: Device, property: string): Z2mExpose | undefined {
  return flattenExposes(device.exposes).find((ex) => (ex.property ?? ex.name) === property)
}

export function isSettable(expose: Z2mExpose | undefined): boolean {
  if (!expose || typeof expose.access !== 'number') return false
  return (expose.access & ACCESS_SET) === ACCESS_SET
}

export function categorize(device: Device): DeviceCategory {
  const flat = flattenExposes(device.exposes)
  const props = new Set(flat.map((e) => e.property ?? e.name).filter(Boolean) as string[])
  const topTypes = new Set(device.exposes?.map((e) => e.type).filter(Boolean) as string[])

  if (topTypes.has('light') || props.has('brightness') || props.has('color') || props.has('color_temp')) return 'light'
  if (topTypes.has('switch') || (props.has('state') && !props.has('contact') && !props.has('temperature'))) return 'switch'
  if (props.has('contact')) return 'contact'
  if (props.has('temperature') || props.has('humidity')) return 'sensor'
  if (topTypes.has('climate')) return 'climate'
  return 'other'
}

export const categoryLabel: Record<DeviceCategory, string> = {
  light: 'Lys',
  switch: 'Kontakter',
  sensor: 'Sensorer',
  contact: 'Dør/vindue',
  climate: 'Klima',
  other: 'Andet',
}

export const categoryIcon: Record<DeviceCategory, string> = {
  light: '💡',
  switch: '🔌',
  sensor: '🌡️',
  contact: '🚪',
  climate: '❄️',
  other: '📦',
}

export function isDeviceOnline(device: Device, staleSeconds = 60 * 60): boolean {
  if (!device.last_seen) return false
  const age = (Date.now() - new Date(device.last_seen).getTime()) / 1000
  return age < staleSeconds
}

export function summarizeState(device: { state: Record<string, unknown> | null }): string {
  const s = device.state
  if (!s) return '—'
  const parts: string[] = []
  if (typeof s.state === 'string') parts.push(s.state)
  if (typeof s.contact === 'boolean') parts.push(s.contact ? 'Lukket' : 'Åben')
  if (typeof s.temperature === 'number') parts.push(`${s.temperature.toFixed(1)}°C`)
  if (typeof s.humidity === 'number') parts.push(`${Math.round(s.humidity)}%`)
  if (typeof s.brightness === 'number') parts.push(`Lys ${Math.round((s.brightness / 254) * 100)}%`)
  if (typeof s.battery === 'number') parts.push(`🔋 ${Math.round(s.battery)}%`)
  return parts.length ? parts.join(' · ') : '—'
}
