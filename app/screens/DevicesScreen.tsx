import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Switch, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, Device, DeviceType } from "../lib/api";

const TYPE_ICON: Record<DeviceType, string> = {
  light: "💡",
  switch: "🔌",
  sensor: "🌡️",
  cover: "🪟",
  lock: "🔒",
  fan: "🌀",
  unknown: "📡",
};

const TYPE_LABEL: Record<DeviceType, string> = {
  light: "Lys",
  switch: "Kontakt",
  sensor: "Sensor",
  cover: "Gardin",
  lock: "Lås",
  fan: "Ventilator",
  unknown: "Enhed",
};

export default function DevicesScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await api.devices.list();
      setDevices(res.devices);
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]));

  const handleToggle = async (device: Device) => {
    if (toggling[device.id]) return;
    setToggling(prev => ({ ...prev, [device.id]: true }));

    const newState = device.state?.state === "ON" ? "OFF" : "ON";
    // Optimistic update
    setDevices(prev =>
      prev.map(d => d.id === device.id ? { ...d, state: { ...d.state, state: newState as "ON" | "OFF" } } : d)
    );

    try {
      await api.devices.set(device.id, { state: newState });
    } catch (err: any) {
      // Revert on error
      setDevices(prev =>
        prev.map(d => d.id === device.id ? { ...d, state: { ...d.state, state: device.state?.state } } : d)
      );
      Alert.alert("Fejl", err.message);
    } finally {
      setTimeout(() => {
        setToggling(prev => ({ ...prev, [device.id]: false }));
        load(); // refresh to get confirmed state
      }, 1000);
    }
  };

  const handleBrightness = async (device: Device, delta: number) => {
    const current = device.state?.brightness ?? 127;
    const next = Math.max(0, Math.min(254, current + delta));
    setDevices(prev =>
      prev.map(d => d.id === device.id ? { ...d, state: { ...d.state, brightness: next, state: next > 0 ? "ON" : "OFF" } } : d)
    );
    try {
      await api.devices.set(device.id, { brightness: next });
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
      load();
    }
  };

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>
  );

  // Group devices by house + room
  const grouped = groupDevices(devices);

  return (
    <FlatList
      style={styles.container}
      data={grouped}
      keyExtractor={(g) => g.key}
      contentContainerStyle={grouped.length === 0 ? styles.emptyContainer : styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📡</Text>
          <Text style={styles.emptyTitle}>Ingen enheder</Text>
          <Text style={styles.emptyText}>Enheder vises her når Zigbee2MQTT opdager dem og de er tilknyttet et rum.</Text>
        </View>
      }
      renderItem={({ item: group }) => (
        <View>
          <View style={styles.groupHeader}>
            <Text style={styles.groupHouse}>{group.house ?? "Ikke tilknyttet"}</Text>
            {group.room && <Text style={styles.groupRoom}> › {group.room}</Text>}
          </View>
          {group.devices.map(device => (
            <DeviceCard
              key={device.id}
              device={device}
              toggling={!!toggling[device.id]}
              onToggle={() => handleToggle(device)}
              onBrightness={(delta) => handleBrightness(device, delta)}
            />
          ))}
        </View>
      )}
    />
  );
}

function DeviceCard({
  device, toggling, onToggle, onBrightness
}: {
  device: Device;
  toggling: boolean;
  onToggle: () => void;
  onBrightness: (delta: number) => void;
}) {
  const isOn = device.state?.state === "ON";
  const hasBrightness = device.type === "light" && device.state?.brightness !== undefined;
  const isControllable = device.type === "light" || device.type === "switch";

  return (
    <View style={[styles.card, isOn && styles.cardOn]}>
      <View style={styles.cardLeft}>
        <Text style={styles.deviceIcon}>{TYPE_ICON[device.type]}</Text>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName} numberOfLines={1}>{device.friendly_name}</Text>
          <Text style={styles.deviceMeta}>
            {TYPE_LABEL[device.type]}
            {device.model ? ` · ${device.model}` : ""}
          </Text>
          {device.type === "sensor" && (
            <View style={styles.sensorRow}>
              {device.state?.temperature != null && (
                <Text style={styles.sensorVal}>🌡️ {Number(device.state.temperature).toFixed(1)}°C</Text>
              )}
              {device.state?.humidity != null && (
                <Text style={styles.sensorVal}>💧 {Number(device.state.humidity).toFixed(1)}%</Text>
              )}
            </View>
          )}
          {device.state?.battery != null && (
            <Text style={styles.battery}>🔋 {device.state.battery}%</Text>
          )}
        </View>
      </View>

      {isControllable && (
        <View style={styles.cardRight}>
          {hasBrightness && isOn && (
            <View style={styles.brightnessRow}>
              <TouchableOpacity style={styles.dimBtn} onPress={() => onBrightness(-42)}>
                <Text style={styles.dimBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.brightnessVal}>
                {Math.round(((device.state?.brightness ?? 0) / 254) * 100)}%
              </Text>
              <TouchableOpacity style={styles.dimBtn} onPress={() => onBrightness(42)}>
                <Text style={styles.dimBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
          <Switch
            value={isOn}
            onValueChange={onToggle}
            disabled={toggling}
            trackColor={{ false: "#334155", true: "#3b82f6" }}
            thumbColor={isOn ? "#fff" : "#64748b"}
            ios_backgroundColor="#334155"
          />
        </View>
      )}
    </View>
  );
}

type Group = { key: string; house: string | null; room: string | null; devices: Device[] };

function groupDevices(devices: Device[]): Group[] {
  const map = new Map<string, Group>();
  for (const d of devices) {
    const key = `${d.house_name ?? ""}:::${d.room_name ?? ""}`;
    if (!map.has(key)) {
      map.set(key, { key, house: d.house_name, room: d.room_name, devices: [] });
    }
    map.get(key)!.devices.push(d);
  }
  return Array.from(map.values());
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  list: { padding: 16, gap: 4 },
  emptyContainer: { flex: 1, justifyContent: "center", padding: 40 },
  empty: { alignItems: "center", gap: 10 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#f1f5f9" },
  emptyText: { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 20 },

  groupHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 4, paddingTop: 16, paddingBottom: 8,
  },
  groupHouse: { fontSize: 13, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  groupRoom: { fontSize: 13, color: "#475569" },

  card: {
    backgroundColor: "#1e293b", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: "#334155",
    flexDirection: "row", alignItems: "center",
    marginBottom: 8,
  },
  cardOn: { borderColor: "#3b82f644", backgroundColor: "#1e3a5f22" },
  cardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  deviceIcon: { fontSize: 26 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 15, fontWeight: "600", color: "#f1f5f9" },
  deviceMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  sensorRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  sensorVal: { fontSize: 13, color: "#94a3b8", fontWeight: "600" },
  battery: { fontSize: 11, color: "#475569", marginTop: 2 },

  cardRight: { alignItems: "flex-end", gap: 8 },
  brightnessRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dimBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#334155",
    alignItems: "center", justifyContent: "center",
  },
  dimBtnText: { fontSize: 16, color: "#94a3b8", fontWeight: "700", lineHeight: Platform.OS === "android" ? 20 : undefined },
  brightnessVal: { fontSize: 12, color: "#64748b", minWidth: 32, textAlign: "center" },
});
