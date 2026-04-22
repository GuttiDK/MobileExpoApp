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
          subscribeToRoomTopics();
        });

        mqttClient.on("message", (topic: string, payload: Buffer) => {
          handleMessage(topic, payload.toString());
        });

        mqttClient.on("error", (err: Error) => {
          console.error("MQTT error:", err.message);
        });

        mqttClient.on("reconnect", () => {
          console.log("MQTT reconnecting...");
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

function subscribeToRoomTopics() {
  const rooms = db.query("SELECT mqtt_topic FROM rooms").all() as { mqtt_topic: string }[];
  rooms.forEach((room) => mqttService.subscribeToTopic(room.mqtt_topic));
  console.log(`Subscribed to ${rooms.length} room topics`);
}

function handleMessage(topic: string, payload: string) {
  try {
    const room = db.query("SELECT id FROM rooms WHERE mqtt_topic = ?").get(topic) as { id: number } | null;
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
      db.run(
        "INSERT INTO sensor_readings (room_id, temperature, humidity) VALUES (?, ?, ?)",
        [room.id, temperature, humidity]
      );
    }
  } catch (err) {
    console.error(`Failed to handle MQTT message on ${topic}:`, err);
  }
}

export function subscribeNewRoom(topic: string) {
  mqttService.subscribeToTopic(topic);
}
