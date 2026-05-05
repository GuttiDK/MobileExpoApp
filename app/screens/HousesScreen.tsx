import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, Modal, TextInput, ActivityIndicator, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, House } from "../lib/api";
import { useAuth } from "../lib/authContext";

export default function HousesScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newHouseName, setNewHouseName] = useState("");
  const [newHouseDesc, setNewHouseDesc] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadHouses = useCallback(async () => {
    try {
      const res = await api.houses.list();
      setHouses(res.houses);
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadHouses(); }, [loadHouses]));

  const handleCreate = async () => {
    if (!newHouseName.trim()) return;
    setSubmitting(true);
    try {
      await api.houses.create(newHouseName.trim(), newHouseDesc.trim() || undefined);
      setShowCreateModal(false);
      setNewHouseName("");
      setNewHouseDesc("");
      loadHouses();
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.houses.join(inviteCode.trim());
      Alert.alert("Tilsluttet!", `Du er nu med i "${res.house_name}"`);
      setShowJoinModal(false);
      setInviteCode("");
      loadHouses();
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const map: Record<string, { label: string; color: string }> = {
      owner: { label: "Ejer", color: "#f59e0b" },
      member: { label: "Medlem", color: "#3b82f6" },
      viewer: { label: "Gæst", color: "#6b7280" },
    };
    return map[role] || map.viewer;
  };

  const renderHouse = ({ item }: { item: House }) => {
    const badge = getRoleBadge(item.my_role);
    return (
      <TouchableOpacity
        style={styles.houseCard}
        onPress={() => navigation.navigate("HouseDetail", { houseId: item.id, houseName: item.name })}
        activeOpacity={0.75}
      >
        <View style={styles.houseIcon}>
          <Text style={styles.houseEmoji}>🏠</Text>
        </View>
        <View style={styles.houseInfo}>
          <Text style={styles.houseName}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.houseDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
          <Text style={styles.houseMeta}>
            {item.member_count} {item.member_count === 1 ? "bruger" : "brugere"}
          </Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: badge.color + "22", borderColor: badge.color + "55" }]}>
          <Text style={[styles.roleBadgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </TouchableOpacity>
    );
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hej, {user?.name?.split(" ")[0]} 👋</Text>
          <Text style={styles.headerTitle}>Dine Huse</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate("Devices")} style={styles.devicesBtn}>
            <Text style={styles.devicesBtnText}>💡</Text>
          </TouchableOpacity>
          {user?.is_admin && (
            <TouchableOpacity onPress={() => navigation.navigate("Admin")} style={styles.adminBtn}>
              <Text style={styles.adminBtnText}>🔧 Admin</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Log ud</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={houses}
        keyExtractor={(h) => h.id.toString()}
        renderItem={renderHouse}
        contentContainerStyle={houses.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHouses(); }} tintColor="#3b82f6" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🏡</Text>
            <Text style={styles.emptyTitle}>Ingen huse endnu</Text>
            <Text style={styles.emptyText}>Opret dit eget hus eller join et med en invite-kode</Text>
          </View>
        }
      />

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.joinBtn} onPress={() => setShowJoinModal(true)}>
          <Text style={styles.joinBtnText}>🔗 Join med kode</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.createBtnText}>+ Opret hus</Text>
        </TouchableOpacity>
      </View>

      {/* Create House Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Opret nyt hus</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Husets navn"
              placeholderTextColor="#64748b"
              value={newHouseName}
              onChangeText={setNewHouseName}
            />
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="Beskrivelse (valgfrit)"
              placeholderTextColor="#64748b"
              value={newHouseDesc}
              onChangeText={setNewHouseDesc}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalCancelText}>Annuller</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleCreate} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Opret</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join House Modal */}
      <Modal visible={showJoinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Join et hus</Text>
            <Text style={styles.modalSubtitle}>Indtast invite-koden du har modtaget</Text>
            <TextInput
              style={[styles.modalInput, { textTransform: "uppercase", letterSpacing: 4, textAlign: "center", fontSize: 22, fontWeight: "700" }]}
              placeholder="ABC123"
              placeholderTextColor="#64748b"
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowJoinModal(false)}>
                <Text style={styles.modalCancelText}>Annuller</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleJoin} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Join</Text>}
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
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20,
  },
  greeting: { fontSize: 14, color: "#64748b" },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#f1f5f9", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  devicesBtn: { padding: 8 },
  devicesBtnText: { fontSize: 20 },
  adminBtn: { padding: 8 },
  adminBtnText: { color: "#f59e0b", fontSize: 14, fontWeight: "600" },
  logoutBtn: { padding: 8 },
  logoutText: { color: "#64748b", fontSize: 14 },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  houseCard: {
    backgroundColor: "#1e293b", borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: "#334155",
  },
  houseIcon: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center",
  },
  houseEmoji: { fontSize: 24 },
  houseInfo: { flex: 1 },
  houseName: { fontSize: 16, fontWeight: "700", color: "#f1f5f9" },
  houseDesc: { fontSize: 13, color: "#64748b", marginTop: 2 },
  houseMeta: { fontSize: 12, color: "#475569", marginTop: 4 },
  roleBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1,
  },
  roleBadgeText: { fontSize: 12, fontWeight: "600" },
  empty: { alignItems: "center", gap: 8 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#f1f5f9" },
  emptyText: { fontSize: 14, color: "#64748b", textAlign: "center" },
  actions: {
    flexDirection: "row", gap: 12, padding: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
  },
  joinBtn: {
    flex: 1, backgroundColor: "#1e293b", borderRadius: 12, padding: 16,
    alignItems: "center", borderWidth: 1, borderColor: "#334155",
  },
  joinBtnText: { color: "#94a3b8", fontWeight: "600", fontSize: 15 },
  createBtn: {
    flex: 1, backgroundColor: "#3b82f6", borderRadius: 12, padding: 16, alignItems: "center",
  },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#1e293b", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#f1f5f9" },
  modalSubtitle: { fontSize: 14, color: "#64748b" },
  modalInput: {
    backgroundColor: "#0f172a", borderRadius: 12, padding: 14,
    color: "#f1f5f9", fontSize: 16, borderWidth: 1, borderColor: "#334155",
  },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#0f172a",
    alignItems: "center", borderWidth: 1, borderColor: "#334155",
  },
  modalCancelText: { color: "#64748b", fontWeight: "600" },
  modalConfirm: {
    flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#3b82f6", alignItems: "center",
  },
  modalConfirmText: { color: "#fff", fontWeight: "700" },
});
