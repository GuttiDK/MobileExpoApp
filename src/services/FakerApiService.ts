// src/services/FakerApiService.ts
// Simulates a BunJS REST API that would normally subscribe to HiveMQ MQTT telemetry.
// Uses fakerjs.dev-style deterministic fake data generation.

import { TelemetryReading, Room, TimeRange } from '../models/TelemetryModels';

const ROOMS: Room[] = [
  { id: 'room-1', name: 'Stue', description: 'Stuen i stueetagen' },
  { id: 'room-2', name: 'Soveværelse', description: 'Soveværelse på 1. sal' },
  { id: 'room-3', name: 'Køkken', description: 'Køkken og alrum' },
  { id: 'room-4', name: 'Kontor', description: 'Hjemmekontor' },
];

// Seeded pseudo-random for reproducible "fake" data
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateReading(
  roomId: string,
  timestamp: Date,
  seed: number
): TelemetryReading {
  const room = ROOMS.find((r) => r.id === roomId) ?? ROOMS[0];

  // Simulate realistic temperature: 18–26°C with daily sinusoidal variation
  const hourOfDay = timestamp.getHours() + timestamp.getMinutes() / 60;
  const dailyCycle = Math.sin((hourOfDay / 24) * 2 * Math.PI - Math.PI / 2);
  const baseTemp = 21 + dailyCycle * 3;
  const noise = (seededRandom(seed) - 0.5) * 2;
  const temperature = Math.round((baseTemp + noise) * 10) / 10;

  // Simulate humidity: 35–65% inversely correlated with temperature
  const baseHumidity = 50 - dailyCycle * 8;
  const humidityNoise = (seededRandom(seed + 1000) - 0.5) * 6;
  const humidity = Math.round(
    Math.max(20, Math.min(90, baseHumidity + humidityNoise)) * 10
  ) / 10;

  return {
    id: `reading-${roomId}-${timestamp.getTime()}`,
    roomId,
    roomName: room.name,
    temperature,
    humidity,
    timestamp: timestamp.toISOString(),
  };
}

function getIntervalMs(range: TimeRange): number {
  switch (range) {
    case '1h': return 5 * 60 * 1000;       // Every 5 minutes → 12 points
    case '1d': return 30 * 60 * 1000;      // Every 30 minutes → 48 points
    case '1w': return 3 * 60 * 60 * 1000;  // Every 3 hours → 56 points
  }
}

function getRangeMs(range: TimeRange): number {
  switch (range) {
    case '1h': return 60 * 60 * 1000;
    case '1d': return 24 * 60 * 60 * 1000;
    case '1w': return 7 * 24 * 60 * 60 * 1000;
  }
}

// Simulate network latency
function simulateLatency(): Promise<void> {
  const ms = 300 + Math.random() * 400;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simulate occasional network failures (5% chance)
function maybeThrow(): void {
  if (Math.random() < 0.05) {
    throw new Error('Netværksfejl: Forbindelsen til API\'et blev afbrudt');
  }
}

export class FakerApiService {
  private static instance: FakerApiService;

  static getInstance(): FakerApiService {
    if (!FakerApiService.instance) {
      FakerApiService.instance = new FakerApiService();
    }
    return FakerApiService.instance;
  }

  async getRooms(): Promise<Room[]> {
    await simulateLatency();
    maybeThrow();
    return [...ROOMS];
  }

  async getLatestReading(roomId: string): Promise<TelemetryReading> {
    await simulateLatency();
    maybeThrow();
    const now = new Date();
    const seed = Math.floor(now.getTime() / (5 * 60 * 1000)); // Changes every 5 min
    return generateReading(roomId, now, seed + roomId.length);
  }

  async getReadings(roomId: string, range: TimeRange): Promise<TelemetryReading[]> {
    await simulateLatency();
    maybeThrow();

    const now = new Date();
    const rangeMs = getRangeMs(range);
    const intervalMs = getIntervalMs(range);
    const readings: TelemetryReading[] = [];

    let time = new Date(now.getTime() - rangeMs);
    let seedBase = Math.floor(time.getTime() / intervalMs);

    while (time <= now) {
      readings.push(generateReading(roomId, new Date(time), seedBase + roomId.length));
      time = new Date(time.getTime() + intervalMs);
      seedBase++;
    }

    return readings;
  }

  // Simulates triggering a servo/ventilation via MQTT command
  async triggerVentilation(roomId: string, open: boolean): Promise<{ success: boolean; message: string }> {
    await simulateLatency();
    maybeThrow();
    return {
      success: true,
      message: open
        ? `Ventilation åbnet i ${ROOMS.find(r => r.id === roomId)?.name ?? roomId}`
        : `Ventilation lukket i ${ROOMS.find(r => r.id === roomId)?.name ?? roomId}`,
    };
  }
}
