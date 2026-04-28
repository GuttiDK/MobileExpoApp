import mqtt from 'mqtt'
import getDb from './db'

declare global {
  // eslint-disable-next-line no-var
  var __mqttClient: mqtt.MqttClient | undefined
  // eslint-disable-next-line no-var
  var __mqttInitialized: boolean | undefined
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

  const client = mqtt.connect(brokerUrl, {
    username,
    password,
    reconnectPeriod: 5000,
  })

  client.on('connect', () => {
    console.log('[MQTT] Connected')
    subscribeToRoomTopics(client)
  })

  client.on('message', (topic, message) => {
    handleMessage(topic, message.toString())
  })

  client.on('error', (err) => {
    console.error('[MQTT] Error:', err.message)
  })

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...')
    subscribeToRoomTopics(client)
  })

  global.__mqttClient = client
}

function subscribeToRoomTopics(client: mqtt.MqttClient) {
  try {
    const db = getDb()
    const rooms = db.prepare('SELECT mqtt_topic FROM rooms WHERE mqtt_topic IS NOT NULL').all() as { mqtt_topic: string }[]
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

function handleMessage(topic: string, payload: string) {
  try {
    const db = getDb()
    const room = db.prepare('SELECT id FROM rooms WHERE mqtt_topic = ?').get(topic) as { id: number } | undefined
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

    db.prepare(
      'INSERT INTO sensor_readings (room_id, temperature, humidity) VALUES (?, ?, ?)'
    ).run(room.id, temperature, humidity)

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
