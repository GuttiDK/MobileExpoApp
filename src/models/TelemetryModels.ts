// src/models/TelemetryModels.ts

export interface TelemetryReading {
  id: string;
  roomId: string;
  roomName: string;
  temperature: number;   // Celsius
  humidity: number;      // %
  timestamp: string;     // ISO 8601 UTC
}

export interface Room {
  id: string;
  name: string;
  description: string;
}

export type TimeRange = '1h' | '1d' | '1w';

export interface ChartDataPoint {
  value: number;
  label: string;
  dataPointText?: string;
}

export interface TelemetrySummary {
  latest: TelemetryReading | null;
  readings: TelemetryReading[];
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  minHumidity: number;
  maxHumidity: number;
  avgHumidity: number;
}

export interface AlarmConfig {
  enabled: boolean;
  minTemperature: number;
  maxTemperature: number;
  minHumidity: number;
  maxHumidity: number;
}

export interface AppState {
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isVentilationOpen: boolean;
}
