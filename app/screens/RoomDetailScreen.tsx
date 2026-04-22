import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, SensorReading } from "../lib/api";

export default function RoomDetailScreen({ route, navigation }: any) {
  const { roomId, roomName } = route.params;
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.rooms.history(roomId, 50);
      setReadings(res.readings);
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roomId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const latest = readings[0];

  const temps = readings.filter(r => r.temperature != null).map(r => r.temperature!);
  const hums = readings.filter(r => r.humidity != null).map(r => r.humidity!);

  const stats = {
    tempMin: temps.length ? Math.min(...temps).toFixed(1) : "—",
    tempMax: temps.length ? Math.max(...temps).toFixed(1) : "—",
    tempAvg: temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : "—",
    humMin: hums.length ? Math.min(...hums).toFixed(1) : "—",
    humMax: hums.length ? Math.max(...hums).toFixed(1) : "—",
    humAvg: hums.length ? (hums.reduce((a, b) => a + b, 0) / hums.length).toFixed(1) : "—",
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("da-DK", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  // Mini spark-line chart
  const SparkLine = ({ values, color, height = 40 }: { values: number[], color: string, height?: number }) => {
    if (values.length < 2) return null;
    const reversed = [...values].reverse();
    const min = Math.min(...reversed);
    const max = Math.max(...reversed);
    const range = max - min || 1;
    const width = 280;
    const points = reversed.map((v, i) => {
      const x = (i / (reversed.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    }).join(" ");

    return (
      <View style={{ height, overflow: "hidden" }}>
        <Text style={{ color: "transparent", position: "absolute" }}>
          {/* SVG not natively in RN - using a simple bar chart instead */}
        </Text>
        <MiniBarChart values={reversed} color={color} height={height} />
      </View>
    );
  };

  const MiniBarChart = ({ values, color, height }: { values: number[], color: string, height: number }) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const last20 = values.slice(-20);

    return (
      <View style={{ flexDirection: "row", alignItems: "flex-end", height, gap: 2 }}>
        {last20.map((v, i) => {
          const barHeight = Math.max(4, ((v - min) / range) * height);
          const isLatest = i === last20.length - 1;
          return (
            <View
              key={i}
              style={{
                flex: 1, height: barHeight, borderRadius: 3,
                backgroundColor: isLatest ? color : color + "66",
              }}
            />
          );
        })}
      </View>
    );
  };

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />
      }
    >
      {/* Live readings */}
      <View style={styles.liveSection}>
        <Text style={styles.liveLabel}>LIVE DATA</Text>
        <View style={styles.liveCards}>
          <View style={[styles.liveCard, { borderColor: "#ef444455" }]}>
            <Text style={styles.liveCardLabel}>Temperatur</Text>
            <Text style={[styles.liveCardValue, { color: "#ef4444" }]}>
              {latest?.temperature != null ? `${latest.temperature.toFixed(1)}°C` : "—"}
            </Text>
            {temps.length > 1 && (
              <View style={styles.sparkContainer}>
                <MiniBarChart values={[...temps].reverse().slice(-15)} color="#ef4444" height={32} />
              </View>
            )}
          </View>

          <View style={[styles.liveCard, { borderColor: "#3b82f655" }]}>
            <Text style={styles.liveCardLabel}>Luftfugtighed</Text>
            <Text style={[styles.liveCardValue, { color: "#3b82f6" }]}>
              {latest?.humidity != null ? `${latest.humidity.toFixed(1)}%` : "—"}
            </Text>
            {hums.length > 1 && (
              <View style={styles.sparkContainer}>
                <MiniBarChart values={[...hums].reverse().slice(-15)} color="#3b82f6" height={32} />
              </View>
            )}
          </View>
        </View>
        {latest && (
          <Text style={styles.lastUpdate}>Sidst opdateret: {formatDate(latest.recorded_at)}</Text>
        )}
      </View>

      {/* Stats */}
      {readings.length > 0 && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Statistik ({readings.length} målinger)</Text>
          <View style={styles.statsGrid}>
            <StatBox label="Min temp" value={`${stats.tempMin}°C`} color="#f97316" />
            <StatBox label="Maks temp" value={`${stats.tempMax}°C`} color="#ef4444" />
            <StatBox label="Gns temp" value={`${stats.tempAvg}°C`} color="#e11d48" />
            <StatBox label="Min fugt" value={`${stats.humMin}%`} color="#06b6d4" />
            <StatBox label="Maks fugt" value={`${stats.humMax}%`} color="#3b82f6" />
            <StatBox label="Gns fugt" value={`${stats.humAvg}%`} color="#6366f1" />
          </View>
        </View>
      )}

      {/* History */}
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Historik</Text>
        {readings.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>Ingen sensor-data endnu</Text>
            <Text style={styles.emptyHint}>Data vises her når MQTT sender målinger til dette rum</Text>
          </View>
        ) : (
          readings.map((r, i) => (
            <View key={i} style={styles.historyRow}>
              <Text style={styles.historyTime}>{formatDate(r.recorded_at)}</Text>
              <View style={styles.historyValues}>
                {r.temperature != null && (
                  <View style={styles.historyChip}>
                    <Text style={styles.historyChipText}>🌡️ {r.temperature.toFixed(1)}°C</Text>
                  </View>
                )}
                {r.humidity != null && (
                  <View style={[styles.historyChip, styles.historyChipBlue]}>
                    <Text style={[styles.historyChipText, { color: "#60a5fa" }]}>💧 {r.humidity.toFixed(1)}%</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statBox, { borderColor: color + "44" }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  liveSection: { padding: 16 },
  liveLabel: { fontSize: 11, color: "#64748b", letterSpacing: 2, marginBottom: 12 },
  liveCards: { flexDirection: "row", gap: 12 },
  liveCard: {
    flex: 1, backgroundColor: "#1e293b", borderRadius: 16, padding: 16,
    borderWidth: 1,
  },
  liveCardLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  liveCardValue: { fontSize: 32, fontWeight: "800", marginTop: 8 },
  sparkContainer: { marginTop: 8 },
  lastUpdate: { fontSize: 12, color: "#475569", marginTop: 8, textAlign: "center" },
  statsSection: { paddingHorizontal: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#94a3b8", marginBottom: 12 },
  statsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
  },
  statBox: {
    flex: 1, minWidth: "30%", backgroundColor: "#1e293b", borderRadius: 12,
    padding: 12, alignItems: "center", borderWidth: 1,
  },
  statValue: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 4, textAlign: "center" },
  historySection: { padding: 16 },
  historyRow: {
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1e293b",
    gap: 6,
  },
  historyTime: { fontSize: 12, color: "#64748b" },
  historyValues: { flexDirection: "row", gap: 8 },
  historyChip: {
    backgroundColor: "#ef444422", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: "#ef444444",
  },
  historyChipBlue: { backgroundColor: "#3b82f622", borderColor: "#3b82f644" },
  historyChipText: { fontSize: 13, color: "#fca5a5", fontWeight: "600" },
  emptyHistory: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#94a3b8" },
  emptyHint: { fontSize: 13, color: "#475569", textAlign: "center", paddingHorizontal: 20 },
});
