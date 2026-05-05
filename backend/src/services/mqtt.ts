import { db } from "../db/schema";
import type { MqttClient } from "mqtt";

let mqttClient: MqttClient | null = null;

export const mqttService = {
  connect() {
    const host = process.env.MQTT_HOST || "localhost";
    const port = process.env.MQTT_PORT || "1883";
    const brokerUrl = `mqtt://${host}:${port}`;
    const username = process.env.MQTT_USERNAME || undefined;
    const password = process.env.MQTT_PASSWORD || undefined;

    import("mqtt")
      .then(({ connect }) => {
        console.log(`Connecting to MQTT broker: ${brokerUrl}`);

        mqttClient = connect(brokerUrl, {
          username,
          password,
          clientId: `homeapp_${Math.random().toString(16).slice(2, 8)}`,
          reconnectPeriod: 5000,
          connectTimeout: 10000,
        });

        mqttClient.on("connect", () => {
          console.log("MQTT connected");
          subscribeToRoomTopics().catch((err) => console.error("Failed to subscribe to room topics:", err));
          subscribeToZigbee();
        });

        mqttClient.on("message", (topic: string, payload: Buffer) => {
          handleMessage(topic, payload.toString());
        });

        mqttClient.on("error", (err: Error) => {
          console.error("MQTT error:", err.message);
        });

        mqttClient.on("reconnect", () => {
          console.log("MQTT reconnecting...");
          subscribeToRoomTopics().catch((err) => console.error("Failed to resubscribe to room topics:", err));
          subscribeToZigbee();
        });

        mqttClient.on("disconnect", () => {
          console.log("MQTT disconnected");
        });
      })
      .catch(() => {
        console.warn("MQTT package not available – MQTT features disabled.");
      });
  },

  subscribeToTopic(topic: string) {
    if (mqttClient?.connected) {
      mqttClient.subscribe(topic, (err) => {
        if (err) console.error(`Failed to subscribe to ${topic}:`, err);
      });
    }
  },

  publish(topic: string, message: string) {
    if (mqttClient?.connected) {
      mqttClient.publish(topic, message);
    }
  },
};

function subscribeToZigbee() {
  if (!mqttClient?.connected) return;
  mqttClient.subscribe("zigbee2mqtt/#", (err) => {
    if (err) console.error("Failed to subscribe to zigbee2mqtt/#:", err);
    else console.log("Subscribed to zigbee2mqtt/#");
  });
}

async function subscribeToRoomTopics() {
  const rooms = await db.query("SELECT mqtt_topic FROM rooms WHERE mqtt_topic NOT LIKE 'zigbee2mqtt/%'").all() as { mqtt_topic: string }[];
  rooms.forEach((room) => mqttService.subscribeToTopic(room.mqtt_topic));
  console.log(`Subscribed to ${rooms.length} room topics`);
}

async function handleMessage(topic: string, payload: string) {
  try {
    if (topic.startsWith("zigbee2mqtt/")) {
      await handleZigbeeMessage(topic, payload);
    } else {
      await handleRoomSensor(topic, payload);
    }
  } catch (err) {
    console.error(`Failed to handle MQTT message on ${topic}:`, err);
  }
}

// ── Zigbee2MQTT handling ──────────────────────────────────────────────────────

async function handleZigbeeMessage(topic: string, payload: string) {
  if (topic === "zigbee2mqtt/bridge/devices") {
    await handleBridgeDevices(payload);
    return;
  }
  // Skip bridge sub-topics, availability, set/get response topics
  if (
    topic.startsWith("zigbee2mqtt/bridge/") ||
    topic.endsWith("/availability") ||
    topic.endsWith("/set") ||
    topic.endsWith("/get")
  ) return;

  // zigbee2mqtt/FRIENDLY_NAME — device state update
  const friendlyName = topic.slice("zigbee2mqtt/".length);
  if (friendlyName) await handleDeviceState(friendlyName, payload);
}

async function handleBridgeDevices(payload: string) {
  let devices: any[];
  try {
    devices = JSON.parse(payload);
    if (!Array.isArray(devices)) return;
  } catch {
    return;
  }

  for (const d of devices) {
    if (!d.friendly_name || d.type === "Coordinator") continue;

    if (d.ieee_address) {
      await db.run(`
        INSERT INTO devices (friendly_name, ieee_address, type, model, vendor, description, definition)
        VALUES (?, ?, ?, ?, ?, ?, ?::jsonb)
        ON CONFLICT (ieee_address) DO UPDATE SET
          friendly_name = EXCLUDED.friendly_name,
          type = EXCLUDED.type,
          model = EXCLUDED.model,
          vendor = EXCLUDED.vendor,
          description = EXCLUDED.description,
          definition = EXCLUDED.definition
      `, [
        d.friendly_name, d.ieee_address, inferDeviceType(d.definition),
        d.definition?.model ?? null, d.definition?.vendor ?? null,
        d.definition?.description ?? null, JSON.stringify(d.definition ?? {}),
      ]);
    } else {
      await db.run(`
        INSERT INTO devices (friendly_name, type, model, vendor, description, definition)
        VALUES (?, ?, ?, ?, ?, ?::jsonb)
        ON CONFLICT (friendly_name) DO UPDATE SET
          type = EXCLUDED.type,
          model = EXCLUDED.model,
          vendor = EXCLUDED.vendor,
          description = EXCLUDED.description,
          definition = EXCLUDED.definition
      `, [
        d.friendly_name, inferDeviceType(d.definition),
        d.definition?.model ?? null, d.definition?.vendor ?? null,
        d.definition?.description ?? null, JSON.stringify(d.definition ?? {}),
      ]);
    }
  }

  console.log(`Zigbee2MQTT: synced ${devices.length} devices`);
}

async function handleDeviceState(friendlyName: string, payload: string) {
  let data: any;
  try {
    data = JSON.parse(payload);
  } catch {
    return;
  }

  const device = await db.query(
    "SELECT id, room_id FROM devices WHERE friendly_name = ?"
  ).get(friendlyName) as { id: number; room_id: number | null } | undefined;

  if (!device) return;

  await db.run(
    "UPDATE devices SET state = ?::jsonb, last_seen = now() WHERE id = ?",
    [JSON.stringify(data), device.id]
  );

  // Save sensor reading if device is assigned to a room and has sensor data
  if (device.room_id) {
    const temp: number | null = data.temperature ?? data.temp ?? null;
    const hum: number | null = data.humidity ?? data.hum ?? null;
    if (temp !== null || hum !== null) {
      await db.run(
        "INSERT INTO sensor_readings (room_id, temperature, humidity) VALUES (?, ?, ?)",
        [device.room_id, temp, hum]
      );
    }
  }
}

function inferDeviceType(definition: any): string {
  if (!definition?.exposes) return "unknown";
  for (const expose of definition.exposes) {
    if (expose.type === "light") return "light";
    if (expose.type === "switch") return "switch";
    if (expose.type === "cover") return "cover";
    if (expose.type === "lock") return "lock";
    if (expose.type === "fan") return "fan";
    if (expose.name === "temperature" || expose.name === "humidity") return "sensor";
  }
  return "unknown";
}

// ── Non-Zigbee room sensor handling ──────────────────────────────────────────

async function handleRoomSensor(topic: string, payload: string) {
  const room = await db.query("SELECT id FROM rooms WHERE mqtt_topic = ?").get(topic) as { id: number } | null;
  if (!room) return;

  let temperature: number | null = null;
  let humidity: number | null = null;

  if (payload.startsWith("{")) {
    const data = JSON.parse(payload);
    temperature = data.temperature ?? data.temp ?? data.t ?? null;
    humidity = data.humidity ?? data.hum ?? data.h ?? null;
  } else {
    const val = parseFloat(payload);
    if (!isNaN(val)) temperature = val;
  }

  if (temperature !== null || humidity !== null) {
    await db.run(
      "INSERT INTO sensor_readings (room_id, temperature, humidity) VALUES (?, ?, ?)",
      [room.id, temperature, humidity]
    );
  }
}

export function subscribeNewRoom(topic: string) {
  if (!topic.startsWith("zigbee2mqtt/")) {
    mqttService.subscribeToTopic(topic);
  }
}
