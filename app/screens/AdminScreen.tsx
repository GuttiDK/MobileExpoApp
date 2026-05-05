import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, Alert, RefreshControl, Platform, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, AdminUser, AdminRoom } from "../lib/api";

const ICONS = ["🏠", "🛋️", "🛏️", "🚿", "🍳", "🚗", "🌿", "📺", "💡", "❄️"];

type Tab = "users" | "rooms";

export default function AdminScreen({ navigation }: any) {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Edit room modal
  const [editRoom, setEditRoom] = useState<AdminRoom | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Generate data modal
  const [genRoom, setGenRoom] = useState<AdminRoom | null>(null);
  const [genTemp, setGenTemp] = useState("");
  const [genHum, setGenHum] = useState("");
  const [genCount, setGenCount] = useState("1");
  const [genSubmitting, setGenSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [uRes, rRes] = await Promise.all([api.admin.getUsers(), api.admin.getRooms()]);
      setUsers(uRes.users);
      setRooms(rRes.rooms);
    } catch (err: any) {
      if (err.message?.includes("Forbidden") || err.message?.includes("403")) {
        Alert.alert("Ingen adgang", "Du har ikke admin-rettigheder.");
        navigation.goBack();
      } else {
        Alert.alert("Fejl", err.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const handleResetPassword = async () => {
    if (!resetTarget || newPassword.length < 6) {
      Alert.alert("Fejl", "Adgangskode skal være mindst 6 tegn.");
      return;
    }
    setResetSubmitting(true);
    try {
      await api.admin.resetPassword(resetTarget.id, newPassword);
      setResetTarget(null);
      setNewPassword("");
      Alert.alert("Nulstillet", `Adgangskode for ${resetTarget.name} er opdateret.`);
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleEditRoom = async () => {
    if (!editRoom || !editName.trim()) return;
    setEditSubmitting(true);
    try {
      await api.admin.updateRoom(editRoom.id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        icon: editIcon,
        mqtt_topic: editTopic.trim() || null,
      });
      setEditRoom(null);
      await loadAll();
      Alert.alert("Gemt", `Rum "${editName}" er opdateret.`);
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    if (!genRoom) return;
    setGenSubmitting(true);
    try {
      const count = Math.max(1, Math.min(50, parseInt(genCount) || 1));
      const temperature = genTemp !== "" ? parseFloat(genTemp) : undefined;
      const humidity = genHum !== "" ? parseFloat(genHum) : undefined;
      const res = await api.admin.generateData(genRoom.id, count, temperature, humidity);
      setGenRoom(null);
      setGenTemp(""); setGenHum(""); setGenCount("1");
      Alert.alert("Genereret", `${res.count} måling(er) tilføjet til "${genRoom.name}".`);
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setGenSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === "users" && styles.tabActive]}
          onPress={() => setTab("users")}
        >
          <Text style={[styles.tabText, tab === "users" && styles.tabTextActive]}>
            👥 Brugere ({users.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "rooms" && styles.tabActive]}
          onPress={() => setTab("rooms")}
        >
          <Text style={[styles.tabText, tab === "rooms" && styles.tabTextActive]}>
            🏠 Rum ({rooms.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "users" && (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#3b82f6" />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  {item.is_admin && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>Admin</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardSub}>{item.email}</Text>
                <Text style={styles.cardMeta}>
                  Oprettet {new Date(item.created_at).toLocaleDateString("da-DK")}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => { setResetTarget(item); setNewPassword(""); }}
              >
                <Text style={styles.actionBtnText}>Nulstil kode</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {tab === "rooms" && (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#3b82f6" />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle}>{item.icon} {item.name}</Text>
                </View>
                <Text style={styles.cardSub}>{item.house_name}</Text>
                {item.mqtt_topic ? (
                  <Text style={styles.mqttTopic}>{item.mqtt_topic}</Text>
                ) : (
                  <Text style={styles.cardMeta}>Ingen MQTT-emne</Text>
                )}
              </View>
              <View style={styles.roomActions}>
                {item.mqtt_topic && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.greenBtn]}
                    onPress={() => {
                      setGenRoom(item);
                      setGenTemp(""); setGenHum(""); setGenCount("1");
                    }}
                  >
                    <Text style={[styles.actionBtnText, styles.greenBtnText]}>Generer</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    setEditRoom(item);
                    setEditName(item.name);
                    setEditDesc(item.description ?? "");
                    setEditIcon(item.icon);
                    setEditTopic(item.mqtt_topic ?? "");
                  }}
                >
                  <Text style={styles.actionBtnText}>Rediger</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Reset password modal */}
      <Modal visible={!!resetTarget} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Nulstil adgangskode</Text>
            {resetTarget && <Text style={styles.modalSub}>{resetTarget.name}</Text>}
            <TextInput
              style={styles.input}
              placeholder="Ny adgangskode (min. 6 tegn)"
              placeholderTextColor="#64748b"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setResetTarget(null)}>
                <Text style={styles.cancelBtnText}>Annuller</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleResetPassword} disabled={resetSubmitting}>
                {resetSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Nulstil</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit room modal */}
      <Modal visible={!!editRoom} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modal}>
            <Text style={styles.modalTitle}>Rediger rum</Text>
            <Text style={styles.fieldLabel}>Ikon</Text>
            <View style={styles.iconGrid}>
              {ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.iconBtn, editIcon === icon && styles.iconBtnActive]}
                  onPress={() => setEditIcon(icon)}
                >
                  <Text style={styles.iconBtnText}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Navn</Text>
            <TextInput
              style={styles.input}
              placeholder="Rum navn"
              placeholderTextColor="#64748b"
              value={editName}
              onChangeText={setEditName}
            />
            <Text style={styles.fieldLabel}>Beskrivelse (valgfri)</Text>
            <TextInput
              style={styles.input}
              placeholder="Beskrivelse..."
              placeholderTextColor="#64748b"
              value={editDesc}
              onChangeText={setEditDesc}
            />
            <Text style={styles.fieldLabel}>MQTT Emne (valgfri)</Text>
            <TextInput
              style={styles.input}
              placeholder="home/stue/sensor"
              placeholderTextColor="#64748b"
              value={editTopic}
              onChangeText={setEditTopic}
              autoCapitalize="none"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditRoom(null)}>
                <Text style={styles.cancelBtnText}>Annuller</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleEditRoom} disabled={editSubmitting}>
                {editSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Gem</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Generate data modal */}
      <Modal visible={!!genRoom} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Generer data</Text>
            {genRoom && <Text style={styles.modalSub}>{genRoom.name}</Text>}
            <Text style={styles.modalHint}>Efterlad felterne tomme for tilfældige værdier</Text>
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Temperatur (°C)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tilfældig"
                  placeholderTextColor="#64748b"
                  value={genTemp}
                  onChangeText={setGenTemp}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Fugtighed (%)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tilfældig"
                  placeholderTextColor="#64748b"
                  value={genHum}
                  onChangeText={setGenHum}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Antal målinger (max 50)</Text>
            <TextInput
              style={styles.input}
              value={genCount}
              onChangeText={setGenCount}
              keyboardType="number-pad"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setGenRoom(null)}>
                <Text style={styles.cancelBtnText}>Annuller</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, styles.greenConfirmBtn]} onPress={handleGenerate} disabled={genSubmitting}>
                {genSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Generer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  tabBar: { flexDirection: "row", backgroundColor: "#1e293b", borderBottomWidth: 1, borderBottomColor: "#334155" },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#3b82f6" },
  tabText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  tabTextActive: { color: "#3b82f6" },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#1e293b", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#334155",
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  cardBody: { flex: 1 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#f1f5f9" },
  cardSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  cardMeta: { fontSize: 12, color: "#475569", marginTop: 4 },
  mqttTopic: { fontSize: 12, color: "#34d399", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", marginTop: 4 },
  adminBadge: { backgroundColor: "#f59e0b22", borderWidth: 1, borderColor: "#f59e0b55", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  adminBadgeText: { fontSize: 11, fontWeight: "600", color: "#f59e0b" },
  roomActions: { flexDirection: "column", gap: 6 },
  actionBtn: { backgroundColor: "#0f172a", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#334155" },
  actionBtnText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  greenBtn: { backgroundColor: "#052e16", borderColor: "#166534" },
  greenBtnText: { color: "#34d399" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#1e293b", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#f1f5f9" },
  modalSub: { fontSize: 14, color: "#64748b", marginTop: -8 },
  modalHint: { fontSize: 13, color: "#475569" },
  fieldLabel: { fontSize: 13, color: "#64748b", marginBottom: -4 },
  input: {
    backgroundColor: "#0f172a", borderRadius: 12, padding: 14,
    color: "#f1f5f9", fontSize: 15, borderWidth: 1, borderColor: "#334155",
  },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconBtn: {
    width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#334155", backgroundColor: "#0f172a",
  },
  iconBtnActive: { borderColor: "#3b82f6", backgroundColor: "#1d4ed822" },
  iconBtnText: { fontSize: 22 },
  row: { flexDirection: "row", gap: 12 },
  halfField: { flex: 1, gap: 4 },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#0f172a", alignItems: "center", borderWidth: 1, borderColor: "#334155" },
  cancelBtnText: { color: "#64748b", fontWeight: "600" },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#3b82f6", alignItems: "center" },
  greenConfirmBtn: { backgroundColor: "#16a34a" },
  confirmBtnText: { color: "#fff", fontWeight: "700" },
});
