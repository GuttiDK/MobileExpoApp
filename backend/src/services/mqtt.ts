import { db } from "../db/schema";

// MQTT via shiftr.io
// Since Bun doesn't have a native MQTT client, we use mqtt.js via npm
// Install: bun add mqtt

let mqttClient: any = null;

export const mqttService = {
  connect() {
    try {
      // Dynamic import to handle cases where mqtt package might not be installed yet
      import("mqtt").then((mqtt) => {
        const brokerUrl = process.env.MQTT_URL || "mqtt://localhost:1883";
        const username = process.env.MQTT_USERNAME || "";
        const password = process.env.MQTT_PASSWORD || "";

        console.log(`🔌 Connecting to MQTT broker: ${brokerUrl}`);

        mqttClient = mqtt.default.connect(brokerUrl, {
          username: username || undefined,
          password: password || undefined,
          clientId: `homeapp_${Math.random().toString(16).slice(2, 8)}`,
          reconnectPeriod: 5000,
          connectTimeout: 10000,
        });

        mqttClient.on("connect", () => {
          console.log("✅ MQTT connected");
          // Subscribe to all room topics
          subscribeToRoomTopics();
        });

        mqttClient.on("message", (topic: string, payload: Buffer) => {
          handleMessage(topic, payload.toString());
        });

        mqttClient.on("error", (err: Error) => {
          console.error("❌ MQTT error:", err.message);
        });

        mqttClient.on("reconnect", () => {
          console.log("🔄 MQTT reconnecting...");
        });

        mqttClient.on("disconnect", () => {
          console.log("📡 MQTT disconnected");
        });
      }).catch((err) => {
        console.warn("⚠️  MQTT package not installed. Run: bun add mqtt");
        console.warn("   MQTT features will be disabled.");
      });
    } catch (err) {
      console.warn("⚠️  Could not start MQTT service:", err);
    }
  },

  subscribeToTopic(topic: string) {
    if (mqttClient?.connected) {
      mqttClient.subscribe(topic, (err: Error | null) => {
        if (err) {
          console.error(`Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`📡 Subscribed to MQTT topic: ${topic}`);
        }
      });
    }
  },

  publish(topic: string, message: string) {
    if (mqttClient?.connected) {
      mqttClient.publish(topic, message);
    }
  },
};

function subscribeToRoomTopics() {
  const rooms = db.query("SELECT mqtt_topic FROM rooms").all() as any[];
  rooms.forEach((room) => {
    mqttService.subscribeToTopic(room.mqtt_topic);
  });
  console.log(`📡 Subscribed to ${rooms.length} room topics`);
}

function handleMessage(topic: string, payload: string) {
  try {
    // Find the room with this topic
    const room = db.query("SELECT id FROM rooms WHERE mqtt_topic = ?").get(topic) as any;
    if (!room) {
      console.warn(`⚠️  No room found for MQTT topic: ${topic}`);
      return;
    }

    // Parse payload - supports multiple formats:
    // {"temperature": 22.5, "humidity": 65}
    // {"temp": 22.5, "hum": 65}
    // {"t": 22.5, "h": 65}
    // "22.5" (just temperature as string)
    let temperature: number | null = null;
    let humidity: number | null = null;

    if (payload.startsWith("{")) {
      const data = JSON.parse(payload);
      temperature = data.temperature ?? data.temp ?? data.t ?? null;
      humidity = data.humidity ?? data.hum ?? data.h ?? null;
    } else {
      // Plain number = temperature
      const val = parseFloat(payload);
      if (!isNaN(val)) temperature = val;
    }

    if (temperature !== null || humidity !== null) {
      db.run(
        "INSERT INTO sensor_readings (room_id, temperature, humidity) VALUES (?, ?, ?)",
        room.id, temperature, humidity
      );
      console.log(`📊 [${topic}] temp=${temperature}°C hum=${humidity}%`);
    }
  } catch (err) {
    console.error(`Failed to handle MQTT message on ${topic}:`, err);
  }
}

// Subscribe to a new topic when a room is created
// This is called from the rooms route
export function subscribeNewRoom(topic: string) {
  mqttService.subscribeToTopic(topic);
}
