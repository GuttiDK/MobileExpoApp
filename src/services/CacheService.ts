// src/services/CacheService.ts
// Persists the latest telemetry data to AsyncStorage so the app
// can show cached data when the network is unavailable.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelemetryReading, Room, TimeRange } from '../models/TelemetryModels';

const KEYS = {
  rooms: 'cache:rooms',
  latest: (roomId: string) => `cache:latest:${roomId}`,
  readings: (roomId: string, range: TimeRange) => `cache:readings:${roomId}:${range}`,
  alarmConfig: 'config:alarm',
  selectedRoom: 'config:selectedRoom',
  ventilationState: (roomId: string) => `state:ventilation:${roomId}`,
};

export interface CachedEntry<T> {
  data: T;
  cachedAt: string; // ISO timestamp
}

export class CacheService {
  private static instance: CacheService;

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private async set<T>(key: string, data: T): Promise<void> {
    try {
      const entry: CachedEntry<T> = { data, cachedAt: new Date().toISOString() };
      await AsyncStorage.setItem(key, JSON.stringify(entry));
    } catch (e) {
      console.warn('Cache write failed:', key, e);
    }
  }

  private async get<T>(key: string): Promise<CachedEntry<T> | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as CachedEntry<T>;
    } catch (e) {
      console.warn('Cache read failed:', key, e);
      return null;
    }
  }

  async saveRooms(rooms: Room[]): Promise<void> {
    await this.set(KEYS.rooms, rooms);
  }

  async getRooms(): Promise<Room[] | null> {
    const entry = await this.get<Room[]>(KEYS.rooms);
    return entry?.data ?? null;
  }

  async saveLatestReading(roomId: string, reading: TelemetryReading): Promise<void> {
    await this.set(KEYS.latest(roomId), reading);
  }

  async getLatestReading(roomId: string): Promise<CachedEntry<TelemetryReading> | null> {
    return this.get<TelemetryReading>(KEYS.latest(roomId));
  }

  async saveReadings(roomId: string, range: TimeRange, readings: TelemetryReading[]): Promise<void> {
    await this.set(KEYS.readings(roomId, range), readings);
  }

  async getReadings(roomId: string, range: TimeRange): Promise<TelemetryReading[] | null> {
    const entry = await this.get<TelemetryReading[]>(KEYS.readings(roomId, range));
    return entry?.data ?? null;
  }

  async saveSelectedRoom(roomId: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.selectedRoom, roomId);
  }

  async getSelectedRoom(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.selectedRoom);
  }

  async saveAlarmConfig(config: object): Promise<void> {
    await this.set(KEYS.alarmConfig, config);
  }

  async getAlarmConfig(): Promise<object | null> {
    const entry = await this.get<object>(KEYS.alarmConfig);
    return entry?.data ?? null;
  }

  async saveVentilationState(roomId: string, isOpen: boolean): Promise<void> {
    await AsyncStorage.setItem(KEYS.ventilationState(roomId), JSON.stringify(isOpen));
  }

  async getVentilationState(roomId: string): Promise<boolean> {
    const val = await AsyncStorage.getItem(KEYS.ventilationState(roomId));
    return val === 'true';
  }
}
