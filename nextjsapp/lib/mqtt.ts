import mqtt from 'mqtt'

declare global {
  // eslint-disable-next-line no-var
  var __mqttClient: mqtt.MqttClient | undefined
  // eslint-disable-next-line no-var
  var __mqttInitialized: boolean | undefined
  // eslint-disable-next-line no-var
  var __z2mDevices: Map<string, Z2mDevice> | undefined
  // eslint-disable-next-line no-var
  var __z2mStates: Map<string, Z2mDeviceState> | undefined
  // eslint-disable-next-line no-var
  var __z2mBridgeOnline: boolean | undefined
  // eslint-disable-next-line no-var
  var __z2mListeners: Set<Z2mStateListener> | undefined
}

export type Z2mStateEvent = {
  ieee_address: string
  friendly_name: string
  state: Record<string, unknown>
  receivedAt: string
}

export type Z2mStateListener = (event: Z2mStateEvent) => void

export type Z2mExpose = {
  type?: string
  name?: string
  property?: string
  access?: number
  values?: unknown[]
  unit?: string
  features?: Z2mExpose[]
  [key: string]: unknown
}

export type Z2mDevice = {
  ieee_address: string
  friendly_name: string
  type?: string
  network_address?: number
  supported?: boolean
  disabled?: boolean
  interview_completed?: boolean
  interviewing?: boolean
  model_id?: string
  manufacturer?: string
  power_source?: string
  date_code?: string
  software_build_id?: string
  definition?: {
    model?: string
    vendor?: string
    description?: string
    exposes?: Z2mExpose[]
    options?: Z2mExpose[]
    supports_ota?: boolean
  }
}

export type Z2mDeviceState = {
  payload: Record<string, unknown>
  receivedAt: string
}

const Z2M_BASE_TOPIC = process.env.Z2M_BASE_TOPIC || 'zigbee2mqtt'

// Lazy-load the DB module so the Postgres pool initialization stays out of the
// instrumentation hook's static module graph.
async function db() {
  const { default: getDb } = await import('./db')
  return getDb()
}

function devices() {
  if (!global.__z2mDevices) global.__z2mDevices = new Map()
  return global.__z2mDevices
}

function states() {
  if (!global.__z2mStates) global.__z2mStates = new Map()
  return global.__z2mStates
}

function listeners() {
  if (!global.__z2mListeners) global.__z2mListeners = new Set()
  return global.__z2mListeners
}

export function onZ2mStateUpdate(listener: Z2mStateListener): () => void {
  listeners().add(listener)
  return () => {
    listeners().delete(listener)
  }
}

function emitStateUpdate(event: Z2mStateEvent) {
  for (const fn of listeners()) {
    try {
      fn(event)
    } catch (err) {
      console.error('[Z2M] Listener error:', err)
    }
  }
}

export function initMqtt() {
  if (global.__mqttInitialized) return
  global.__mqttInitialized = true

  const host = process.env.MQTT_HOST || 'localhost'
  const port = parseInt(process.env.MQTT_PORT || '1883', 10)
  const username = process.env.MQTT_USERNAME || undefined
  const password = process.env.MQTT_PASSWORD || undefined

  const brokerUrl = `mqtt://${host}:${port}`
  console.log(`[MQTT] Connecting to ${brokerUrl}`)

  const client = mqtt.connect(brokerUrl, { username, password, reconnectPeriod: 5000 })

  client.on('connect', () => {
    console.log('[MQTT] Connected')
    subscribeAll(client)
  })

  client.on('message', (topic, message) => {
    handleMessage(topic, message.toString()).catch((err) =>
      console.error('[MQTT] Handle message error:', err),
    )
  })

  client.on('error', (err) => {
    console.error('[MQTT] Error:', err.message)
  })

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...')
    subscribeAll(client)
  })

  global.__mqttClient = client
}

function subscribeAll(client: mqtt.MqttClient) {
  subscribeRoomTopics(client).catch((err) =>
    console.error('[MQTT] Subscribe error (rooms):', err),
  )
  subscribeZ2mTopics(client)
}

function subscribeZ2mTopics(client: mqtt.MqttClient) {
  const topics = [
    `${Z2M_BASE_TOPIC}/bridge/state`,
    `${Z2M_BASE_TOPIC}/bridge/devices`,
    `${Z2M_BASE_TOPIC}/bridge/event`,
    `${Z2M_BASE_TOPIC}/+`,
  ]
  for (const topic of topics) {
    client.subscribe(topic, (err) => {
      if (err) console.error(`[MQTT] Subscribe error for ${topic}:`, err)
      else console.log(`[MQTT] Subscribed to ${topic}`)
    })
  }
}

async function subscribeRoomTopics(client: mqtt.MqttClient) {
  try {
    const database = await db()
    const rooms = (await database
      .prepare('SELECT mqtt_topic FROM rooms WHERE mqtt_topic IS NOT NULL')
      .all()) as { mqtt_topic: string }[]
    for (const room of rooms) {
      if (room.mqtt_topic) {
        client.subscribe(room.mqtt_topic, (err) => {
          if (err) console.error(`[MQTT] Subscribe error for ${room.mqtt_topic}:`, err)
          else console.log(`[MQTT] Subscribed to ${room.mqtt_topic}`)
        })
      }
    }
  } catch (err) {
    console.error('[MQTT] Error loading room topics:', err)
  }
}

async function handleMessage(topic: string, payload: string) {
  if (topic === `${Z2M_BASE_TOPIC}/bridge/state`) {
    handleBridgeState(payload)
    return
  }
  if (topic === `${Z2M_BASE_TOPIC}/bridge/devices`) {
    handleBridgeDevices(payload)
    return
  }
  if (topic === `${Z2M_BASE_TOPIC}/bridge/event`) {
    handleBridgeEvent(payload)
    return
  }
  if (
    topic.startsWith(`${Z2M_BASE_TOPIC}/`) &&
    !topic.startsWith(`${Z2M_BASE_TOPIC}/bridge`)
  ) {
    const friendlyName = topic.slice(Z2M_BASE_TOPIC.length + 1)
    if (friendlyName && !friendlyName.includes('/')) {
      handleZ2mDeviceState(friendlyName, payload)
    }
  }

  await handleRoomMessage(topic, payload)
}

function handleBridgeState(payload: string) {
  let state: string | undefined
  try {
    const parsed = JSON.parse(payload)
    state = typeof parsed === 'string' ? parsed : parsed?.state
  } catch {
    state = payload
  }
  global.__z2mBridgeOnline = state === 'online'
  console.log(`[Z2M] Bridge state: ${state}`)
}

function handleBridgeDevices(payload: string) {
  try {
    const list = JSON.parse(payload) as Z2mDevice[]
    if (!Array.isArray(list)) return
    const map = devices()
    map.clear()
    for (const dev of list) {
      if (dev?.ieee_address) map.set(dev.ieee_address, dev)
    }
    console.log(`[Z2M] Devices updated: ${map.size}`)
    persistDevices(list).catch((err) =>
      console.error('[Z2M] Failed to persist devices:', err),
    )
  } catch (err) {
    console.error('[Z2M] Failed to parse bridge/devices:', err)
  }
}

async function persistDevices(list: Z2mDevice[]) {
  const database = await db()
  for (const dev of list) {
    if (!dev?.ieee_address || dev.type === 'Coordinator') continue
    await database
      .prepare(
        `INSERT INTO devices (ieee_address, friendly_name, type, model, vendor, description, supported, exposes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
         ON CONFLICT (ieee_address) DO UPDATE SET
           friendly_name = EXCLUDED.friendly_name,
           type = EXCLUDED.type,
           model = EXCLUDED.model,
           vendor = EXCLUDED.vendor,
           description = EXCLUDED.description,
           supported = EXCLUDED.supported,
           exposes = EXCLUDED.exposes`,
      )
      .run(
        dev.ieee_address,
        dev.friendly_name,
        dev.type ?? null,
        dev.definition?.model ?? dev.model_id ?? null,
        dev.definition?.vendor ?? dev.manufacturer ?? null,
        dev.definition?.description ?? null,
        dev.supported ?? false,
        JSON.stringify(dev.definition?.exposes ?? []),
      )
  }
}

function handleBridgeEvent(payload: string) {
  try {
    const event = JSON.parse(payload) as { type?: string; data?: Record<string, unknown> }
    const type = event?.type
    const data = event?.data || {}
    console.log(`[Z2M] Bridge event: ${type}`, data)
    // Authoritative device list arrives via bridge/devices (retained), so
    // we only log events here; the cache will be refreshed when the bridge
    // republishes the device list after join/leave/rename.
  } catch (err) {
    console.error('[Z2M] Failed to parse bridge/event:', err)
  }
}

function handleZ2mDeviceState(friendlyName: string, payload: string) {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(payload)
  } catch {
    return
  }
  if (!parsed || typeof parsed !== 'object') return
  const receivedAt = new Date().toISOString()
  states().set(friendlyName, { payload: parsed, receivedAt })

  let ieee: string | undefined
  for (const d of devices().values()) {
    if (d.friendly_name === friendlyName) {
      ieee = d.ieee_address
      break
    }
  }
  if (ieee) {
    emitStateUpdate({ ieee_address: ieee, friendly_name: friendlyName, state: parsed, receivedAt })
  }

  persistDeviceState(friendlyName, parsed).catch((err) =>
    console.error(`[Z2M] Failed to persist state for ${friendlyName}:`, err),
  )
}

async function persistDeviceState(friendlyName: string, payload: Record<string, unknown>) {
  let dev: Z2mDevice | undefined
  for (const d of devices().values()) {
    if (d.friendly_name === friendlyName) {
      dev = d
      break
    }
  }
  if (!dev) return

  const database = await db()
  await database
    .prepare(
      `INSERT INTO device_states (ieee_address, state, updated_at)
       VALUES (?, ?::jsonb, now())
       ON CONFLICT (ieee_address) DO UPDATE SET
         state = EXCLUDED.state,
         updated_at = EXCLUDED.updated_at`,
    )
    .run(dev.ieee_address, JSON.stringify(payload))

  await database
    .prepare('UPDATE devices SET last_seen = now() WHERE ieee_address = ?')
    .run(dev.ieee_address)

  const temperature = typeof payload.temperature === 'number' ? payload.temperature : null
  const humidity = typeof payload.humidity === 'number' ? payload.humidity : null
  if (temperature === null && humidity === null) return

  const row = (await database
    .prepare('SELECT room_id FROM devices WHERE ieee_address = ?')
    .get(dev.ieee_address)) as { room_id: number | null } | undefined
  if (!row?.room_id) return

  await database
    .prepare('INSERT INTO sensor_readings (room_id, temperature, humidity) VALUES (?, ?, ?)')
    .run(row.room_id, temperature, humidity)
}

async function handleRoomMessage(topic: string, payload: string) {
  try {
    const database = await db()
    const room = (await database
      .prepare('SELECT id FROM rooms WHERE mqtt_topic = ?')
      .get(topic)) as { id: number } | undefined
    if (!room) return

    let temperature: number | null = null
    let humidity: number | null = null

    try {
      const parsed = JSON.parse(payload)
      temperature = typeof parsed.temperature === 'number' ? parsed.temperature : null
      humidity = typeof parsed.humidity === 'number' ? parsed.humidity : null
    } catch {
      const val = parseFloat(payload)
      if (!isNaN(val)) temperature = val
    }

    if (temperature === null && humidity === null) return

    await database
      .prepare('INSERT INTO sensor_readings (room_id, temperature, humidity) VALUES (?, ?, ?)')
      .run(room.id, temperature, humidity)

    console.log(`[MQTT] Saved reading for room ${room.id}: temp=${temperature} hum=${humidity}`)
  } catch (err) {
    console.error('[MQTT] Error handling message:', err)
  }
}

export function subscribeRoomTopic(topic: string) {
  if (!global.__mqttClient?.connected) return
  global.__mqttClient.subscribe(topic, (err) => {
    if (err) console.error(`[MQTT] Subscribe error for ${topic}:`, err)
  })
}

export function publishZ2m(topicSuffix: string, payload: unknown): boolean {
  const client = global.__mqttClient
  if (!client?.connected) {
    console.warn('[Z2M] Publish skipped — client not connected')
    return false
  }
  const topic = `${Z2M_BASE_TOPIC}/${topicSuffix.replace(/^\//, '')}`
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  client.publish(topic, body)
  return true
}

export function getZ2mDevices(): Z2mDevice[] {
  return Array.from(devices().values())
}

export function getZ2mDevice(ieeeOrName: string): Z2mDevice | undefined {
  const map = devices()
  if (map.has(ieeeOrName)) return map.get(ieeeOrName)
  for (const dev of map.values()) {
    if (dev.friendly_name === ieeeOrName) return dev
  }
  return undefined
}

export function getZ2mDeviceState(friendlyName: string): Z2mDeviceState | undefined {
  return states().get(friendlyName)
}

export function isZ2mBridgeOnline(): boolean {
  return global.__z2mBridgeOnline === true
}
