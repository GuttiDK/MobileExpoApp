// src/viewmodels/TelemetryViewModel.ts
// MVVM ViewModel: exposes observable state and commands to the View layer.
// The View (screen components) binds to this ViewModel via the useTelemetry hook.

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Network from 'expo-network';
import { FakerApiService } from '../services/FakerApiService';
import { CacheService } from '../services/CacheService';
import {
  TelemetryReading,
  Room,
  TimeRange,
  ChartDataPoint,
  TelemetrySummary,
  AlarmConfig,
  AppState,
} from '../models/TelemetryModels';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';

const DEFAULT_ALARM: AlarmConfig = {
  enabled: true,
  minTemperature: 17,
  maxTemperature: 26,
  minHumidity: 30,
  maxHumidity: 70,
};

const REFRESH_INTERVAL_MS = 30_000;
const NETWORK_POLL_MS = 5_000;

export function useTelemetryViewModel() {
  const api = FakerApiService.getInstance();
  const cache = CacheService.getInstance();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('room-1');
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1h');
  const [latestReading, setLatestReading] = useState<TelemetryReading | null>(null);
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [alarmConfig, setAlarmConfig] = useState<AlarmConfig>(DEFAULT_ALARM);
  const [activeAlarms, setActiveAlarms] = useState<string[]>([]);
  const [appState, setAppState] = useState<AppState>({
    isOnline: true,
    isLoading: false,
    error: null,
    lastUpdated: null,
    isVentilationOpen: false,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const networkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const temperatureChartData: ChartDataPoint[] = readings.map((r) => ({
    value: r.temperature,
    label: formatChartLabel(r.timestamp, selectedRange),
    dataPointText: `${r.temperature}°`,
  }));

  const humidityChartData: ChartDataPoint[] = readings.map((r) => ({
    value: r.humidity,
    label: formatChartLabel(r.timestamp, selectedRange),
    dataPointText: `${r.humidity}%`,
  }));

  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setAppState((prev) => ({ ...prev, isOnline: !!state.isConnected }));
      } catch {
        setAppState((prev) => ({ ...prev, isOnline: false }));
      }
    };
    checkNetwork();
    networkTimerRef.current = setInterval(checkNetwork, NETWORK_POLL_MS);
    return () => { if (networkTimerRef.current) clearInterval(networkTimerRef.current); };
  }, []);

  useEffect(() => { initializeApp(); }, []);
  useEffect(() => { loadData(); }, [selectedRoomId, selectedRange]);

  useEffect(() => {
    refreshTimerRef.current = setInterval(() => { loadData(); }, REFRESH_INTERVAL_MS);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [selectedRoomId, selectedRange]);

  useEffect(() => {
    if (!latestReading || !alarmConfig.enabled) { setActiveAlarms([]); return; }
    const alarms: string[] = [];
    if (latestReading.temperature < alarmConfig.minTemperature)
      alarms.push(`🥶 Temperatur for lav: ${latestReading.temperature}°C (min ${alarmConfig.minTemperature}°C)`);
    if (latestReading.temperature > alarmConfig.maxTemperature)
      alarms.push(`🔥 Temperatur for høj: ${latestReading.temperature}°C (max ${alarmConfig.maxTemperature}°C)`);
    if (latestReading.humidity < alarmConfig.minHumidity)
      alarms.push(`🌵 Luftfugtighed for lav: ${latestReading.humidity}% (min ${alarmConfig.minHumidity}%)`);
    if (latestReading.humidity > alarmConfig.maxHumidity)
      alarms.push(`💧 Luftfugtighed for høj: ${latestReading.humidity}% (max ${alarmConfig.maxHumidity}%)`);
    setActiveAlarms(alarms);
  }, [latestReading, alarmConfig]);

  const initializeApp = useCallback(async () => {
    const savedRoom = await cache.getSelectedRoom();
    if (savedRoom) setSelectedRoomId(savedRoom);
    const savedAlarm = await cache.getAlarmConfig();
    if (savedAlarm) setAlarmConfig(savedAlarm as AlarmConfig);
    const savedVent = await cache.getVentilationState(selectedRoomId);
    setAppState((prev) => ({ ...prev, isVentilationOpen: savedVent }));
    await loadRooms();
    await loadData();
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const fetched = await api.getRooms();
      setRooms(fetched);
      await cache.saveRooms(fetched);
    } catch {
      const cached = await cache.getRooms();
      if (cached) setRooms(cached);
    }
  }, []);

  const loadData = useCallback(async () => {
    setAppState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const [latest, rangeReadings] = await Promise.all([
        api.getLatestReading(selectedRoomId),
        api.getReadings(selectedRoomId, selectedRange),
      ]);
      setLatestReading(latest);
      setReadings(rangeReadings);
      setSummary(computeSummary(latest, rangeReadings));
      await cache.saveLatestReading(selectedRoomId, latest);
      await cache.saveReadings(selectedRoomId, selectedRange, rangeReadings);
      setAppState((prev) => ({ ...prev, isLoading: false, lastUpdated: new Date(), error: null }));
    } catch (err) {
      const [cachedLatest, cachedReadings] = await Promise.all([
        cache.getLatestReading(selectedRoomId),
        cache.getReadings(selectedRoomId, selectedRange),
      ]);
      if (cachedLatest) setLatestReading(cachedLatest.data);
      if (cachedReadings) setReadings(cachedReadings);
      if (cachedLatest || cachedReadings) {
        setSummary(computeSummary(cachedLatest?.data ?? null, cachedReadings ?? []));
      }
      setAppState((prev) => ({ ...prev, isLoading: false, error: 'Viser cachet data — ingen netværksforbindelse' }));
    }
  }, [selectedRoomId, selectedRange]);

  const selectRoom = useCallback(async (roomId: string) => {
    setSelectedRoomId(roomId);
    await cache.saveSelectedRoom(roomId);
    const savedVent = await cache.getVentilationState(roomId);
    setAppState((prev) => ({ ...prev, isVentilationOpen: savedVent }));
  }, []);

  const toggleVentilation = useCallback(async () => {
    const nextState = !appState.isVentilationOpen;
    try {
      await api.triggerVentilation(selectedRoomId, nextState);
      setAppState((prev) => ({ ...prev, isVentilationOpen: nextState }));
      await cache.saveVentilationState(selectedRoomId, nextState);
    } catch {
      setAppState((prev) => ({ ...prev, error: 'Kunne ikke sende ventilationskommando' }));
    }
  }, [appState.isVentilationOpen, selectedRoomId]);

  const updateAlarmConfig = useCallback(async (config: AlarmConfig) => {
    setAlarmConfig(config);
    await cache.saveAlarmConfig(config);
  }, []);

  const refresh = useCallback(() => loadData(), [loadData]);

  return {
    rooms, selectedRoomId, selectedRange, latestReading, readings,
    summary, temperatureChartData, humidityChartData, alarmConfig,
    activeAlarms, appState,
    selectRoom, setSelectedRange, toggleVentilation, updateAlarmConfig, refresh,
  };
}

function formatChartLabel(isoTimestamp: string, range: TimeRange): string {
  const date = new Date(isoTimestamp);
  switch (range) {
    case '1h': return format(date, 'HH:mm');
    case '1d': return format(date, 'HH:mm');
    case '1w': return format(date, 'EEE HH', { locale: da });
    default:   return format(date, 'HH:mm');
  }
}

function computeSummary(latest: TelemetryReading | null, readings: TelemetryReading[]): TelemetrySummary {
  if (!readings.length) {
    return { latest, readings, minTemp: 0, maxTemp: 0, avgTemp: 0, minHumidity: 0, maxHumidity: 0, avgHumidity: 0 };
  }
  const temps  = readings.map((r) => r.temperature);
  const humids = readings.map((r) => r.humidity);
  const avg    = (arr: number[]) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  return {
    latest, readings,
    minTemp: Math.min(...temps), maxTemp: Math.max(...temps), avgTemp: avg(temps),
    minHumidity: Math.min(...humids), maxHumidity: Math.max(...humids), avgHumidity: avg(humids),
  };
}
