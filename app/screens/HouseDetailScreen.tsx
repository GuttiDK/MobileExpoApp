import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator, Share, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, House, Member, Room } from "../lib/api";
import { useAuth } from "../lib/authContext";

const ROOM_ICONS = ["🌡️", "🛏️", "🛁", "🍳", "🛋️", "🏢", "🚗", "🌿", "💻", "🎮", "📚", "🎵"];
const ROLES: Array<"member" | "viewer"> = ["member", "viewer"];
const ROLE_LABELS: Record<string, string> = { owner: "Ejer", member: "Medlem", viewer: "Gæst" };

export default function HouseDetailScreen({ route, navigation }: any) {
  const { houseId } = route.params;
  const { user } = useAuth();
  const [house, setHouse] = useState<House | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"rooms" | "members">("rooms");
  const [submitting, setSubmitting] = useState(false);

  // Create room modal
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [roomTopic, setRoomTopic] = useState("");
  const [roomIcon, setRoomIcon] = useState("🌡️");

  // Edit house modal
  const [showEditHouse, setShowEditHouse] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // House management sheet
  const [showManage, setShowManage] = useState(false);

  // Member options sheet
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const isOwner = house?.my_role === "owner";
  const isOwnerOrMember = house?.my_role === "owner" || house?.my_role === "member";

  const load = useCallback(async () => {
    try {
      const res = await api.houses.get(houseId);
      setHouse(res.house);
      setMembers(res.members);
      setRooms(res.rooms);
      navigation.setOptions({ title: res.house.name });
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [houseId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── House management ─────────────────────────────────────────────

  const handleEditHouse = async () => {
    if (!editName.trim()) return;
    setSubmitting(true);
    try {
      await api.houses.update(houseId, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setShowEditHouse(false);
      load();
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHouse = () => {
    setShowManage(false);
    Alert.alert(
      "Slet hus",
      `Er du sikker på du vil slette "${house?.name}"? Dette kan ikke fortrydes.`,
      [
        { text: "Annuller", style: "cancel" },
        {
          text: "Slet", style: "destructive",
          onPress: async () => {
            try {
              await api.houses.delete(houseId);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert("Fejl", err.message);
            }
          },
        },
      ]
    );
  };

  const handleLeaveHouse = () => {
    setShowManage(false);
    Alert.alert(
      "Forlad hus",
      `Er du sikker på du vil forlade "${house?.name}"?`,
      [
        { text: "Annuller", style: "cancel" },
        {
          text: "Forlad", style: "destructive",
          onPress: async () => {
            try {
              await api.houses.leave(houseId);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert("Fejl", err.message);
            }
          },
        },
      ]
    );
  };

  const handleRegenerateInvite = async () => {
    setShowManage(false);
    try {
      await api.houses.regenerateInvite(houseId);
      load();
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    }
  };

  const shareInvite = async () => {
    if (!house) return;
    try {
      await Share.share({
        message: `Join mit hus "${house.name}" i HomeApp! Brug invite-koden: ${house.invite_code}`,
        title: "HomeApp Invite",
      });
    } catch {}
  };

  // ── Room management ───────────────────────────────────────────────

  const handleCreateRoom = async () => {
    if (!roomName.trim() || !roomTopic.trim()) {
      Alert.alert("Fejl", "Navn og MQTT-topic er påkrævet");
      return;
    }
    setSubmitting(true);
    try {
      await api.rooms.create({
        house_id: houseId,
        name: roomName.trim(),
        description: roomDesc.trim() || undefined,
        icon: roomIcon,
        mqtt_topic: roomTopic.trim(),
      });
      setShowCreateRoom(false);
      setRoomName(""); setRoomDesc(""); setRoomTopic(""); setRoomIcon("🌡️");
      load();
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRoom = (room: Room) => {
    Alert.alert("Slet rum", `Er du sikker på du vil slette "${room.name}"?`, [
      { text: "Annuller", style: "cancel" },
      {
        text: "Slet", style: "destructive",
        onPress: async () => {
          try {
            await api.rooms.delete(room.id);
            load();
          } catch (err: any) {
            Alert.alert("Fejl", err.message);
          }
        },
      },
    ]);
  };

  // ── Member management ─────────────────────────────────────────────

  const handleRemoveMember = (member: Member) => {
    setSelectedMember(null);
    Alert.alert(
      "Fjern bruger",
      `Er du sikker på du vil fjerne ${member.name} fra huset?`,
      [
        { text: "Annuller", style: "cancel" },
        {
          text: "Fjern", style: "destructive",
          onPress: async () => {
            try {
              await api.houses.removeMember(houseId, member.id);
              load();
            } catch (err: any) {
              Alert.alert("Fejl", err.message);
            }
          },
        },
      ]
    );
  };

  const handleChangeRole = async (member: Member, role: "member" | "viewer") => {
    setSelectedMember(null);
    try {
      await api.houses.updateMemberRole(houseId, member.id, role);
      load();
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "Ingen data";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "Lige nu";
    if (diff < 3600) return `${Math.floor(diff / 60)} min siden`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} t siden`;
    return d.toLocaleDateString("da-DK");
  };

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>
  );

  return (
    <View style={styles.container}>
      {/* Invite banner */}
      {house && (
        <TouchableOpacity style={styles.inviteBanner} onPress={shareInvite}
          onLongPress={() => isOwner && handleRegenerateInvite()}>
          <View>
            <Text style={styles.inviteLabel}>Invite-kode  {isOwner && "(hold nede for ny kode)"}</Text>
            <Text style={styles.inviteCode}>{house.invite_code}</Text>
          </View>
          <Text style={styles.shareText}>Del 🔗</Text>
        </TouchableOpacity>
      )}

      {/* Tabs + manage button */}
      <View style={styles.tabRow}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "rooms" && styles.tabActive]}
            onPress={() => setActiveTab("rooms")}
          >
            <Text style={[styles.tabText, activeTab === "rooms" && styles.tabTextActive]}>
              🏠 Rum ({rooms.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "members" && styles.tabActive]}
            onPress={() => setActiveTab("members")}
          >
            <Text style={[styles.tabText, activeTab === "members" && styles.tabTextActive]}>
              👥 Brugere ({members.length})
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.manageBtn} onPress={() => setShowManage(true)}>
          <Text style={styles.manageBtnText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />
        }
      >
        {/* ── Rooms tab ── */}
        {activeTab === "rooms" && (
          <View style={styles.section}>
            {rooms.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyEmoji}>🌡️</Text>
                <Text style={styles.emptyTitle}>Ingen rum endnu</Text>
                {isOwnerOrMember && (
                  <Text style={styles.emptyText}>Opret et rum og tilknyt et MQTT-topic</Text>
                )}
              </View>
            ) : (
              rooms.map((room) => (
                <TouchableOpacity
                  key={room.id}
                  style={styles.roomCard}
                  onPress={() => navigation.navigate("RoomDetail", { roomId: room.id, roomName: room.name })}
                  onLongPress={() => isOwnerOrMember && handleDeleteRoom(room)}
                  activeOpacity={0.8}
                >
                  <View style={styles.roomHeader}>
                    <Text style={styles.roomEmoji}>{room.icon}</Text>
                    <View style={styles.roomInfo}>
                      <Text style={styles.roomName}>{room.name}</Text>
                      <Text style={styles.roomTopic}>📡 {room.mqtt_topic}</Text>
                    </View>
                    {isOwnerOrMember && (
                      <TouchableOpacity onPress={() => handleDeleteRoom(room)} style={styles.deleteRoomBtn}>
                        <Text style={styles.deleteRoomBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.sensorRow}>
                    <View style={styles.sensorBox}>
                      <Text style={styles.sensorLabel}>Temperatur</Text>
                      <Text style={styles.sensorValue}>
                        {room.last_temperature != null ? `${room.last_temperature.toFixed(1)}°C` : "—"}
                      </Text>
                    </View>
                    <View style={[styles.sensorBox, styles.sensorBoxRight]}>
                      <Text style={styles.sensorLabel}>Luftfugtighed</Text>
                      <Text style={styles.sensorValue}>
                        {room.last_humidity != null ? `${room.last_humidity.toFixed(1)}%` : "—"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.lastUpdate}>Opdateret: {formatTime(room.last_reading_at)}</Text>
                </TouchableOpacity>
              ))
            )}
            {isOwnerOrMember && (
              <TouchableOpacity style={styles.addRoomBtn} onPress={() => setShowCreateRoom(true)}>
                <Text style={styles.addRoomBtnText}>+ Tilføj rum</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Members tab ── */}
        {activeTab === "members" && (
          <View style={styles.section}>
            {members.map((member) => {
              const isSelf = member.id === user?.id;
              const canManage = isOwner && !isSelf && member.role !== "owner";
              return (
                <TouchableOpacity
                  key={member.id}
                  style={styles.memberCard}
                  onPress={() => canManage && setSelectedMember(member)}
                  activeOpacity={canManage ? 0.7 : 1}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{member.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}{isSelf ? " (dig)" : ""}</Text>
                    <Text style={styles.memberEmail}>{member.email}</Text>
                  </View>
                  <View style={styles.memberRight}>
                    <RoleBadge role={member.role} />
                    {canManage && <Text style={styles.memberEditHint}>Tryk</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── House Management Sheet ── */}
      <Modal visible={showManage} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowManage(false)}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Hus-indstillinger</Text>

            {isOwner && (
              <TouchableOpacity style={styles.sheetItem} onPress={() => {
                setShowManage(false);
                setEditName(house?.name ?? "");
                setEditDesc(house?.description ?? "");
                setShowEditHouse(true);
              }}>
                <Text style={styles.sheetItemIcon}>✏️</Text>
                <Text style={styles.sheetItemText}>Rediger hus</Text>
              </TouchableOpacity>
            )}

            {isOwner && (
              <TouchableOpacity style={styles.sheetItem} onPress={handleRegenerateInvite}>
                <Text style={styles.sheetItemIcon}>🔄</Text>
                <Text style={styles.sheetItemText}>Generer ny invite-kode</Text>
              </TouchableOpacity>
            )}

            <View style={styles.sheetDivider} />

            {!isOwner && (
              <TouchableOpacity style={styles.sheetItem} onPress={handleLeaveHouse}>
                <Text style={styles.sheetItemIcon}>🚪</Text>
                <Text style={[styles.sheetItemText, styles.danger]}>Forlad hus</Text>
              </TouchableOpacity>
            )}

            {isOwner && (
              <TouchableOpacity style={styles.sheetItem} onPress={handleDeleteHouse}>
                <Text style={styles.sheetItemIcon}>🗑️</Text>
                <Text style={[styles.sheetItemText, styles.danger]}>Slet hus</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit House Modal ── */}
      <Modal visible={showEditHouse} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Rediger hus</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Husets navn"
              placeholderTextColor="#64748b"
              value={editName}
              onChangeText={setEditName}
            />
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="Beskrivelse (valgfrit)"
              placeholderTextColor="#64748b"
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditHouse(false)}>
                <Text style={styles.modalCancelText}>Annuller</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleEditHouse} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Gem</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Member Options Sheet ── */}
      <Modal visible={!!selectedMember} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedMember(null)}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{selectedMember?.name}</Text>
            <Text style={styles.modalSubtitle}>Skift rolle</Text>
            {ROLES.map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.sheetItem, selectedMember?.role === role && styles.sheetItemActive]}
                onPress={() => selectedMember && handleChangeRole(selectedMember, role)}
              >
                <Text style={styles.sheetItemIcon}>{role === "member" ? "🔧" : "👁️"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetItemText}>{ROLE_LABELS[role]}</Text>
                  <Text style={styles.sheetItemSub}>
                    {role === "member" ? "Kan oprette og slette rum" : "Kan kun se data"}
                  </Text>
                </View>
                {selectedMember?.role === role && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
            <View style={styles.sheetDivider} />
            <TouchableOpacity style={styles.sheetItem} onPress={() => selectedMember && handleRemoveMember(selectedMember)}>
              <Text style={styles.sheetItemIcon}>🚫</Text>
              <Text style={[styles.sheetItemText, styles.danger]}>Fjern fra huset</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Create Room Modal ── */}
      <Modal visible={showCreateRoom} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Opret rum</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPicker}>
              {ROOM_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.iconOption, roomIcon === icon && styles.iconOptionActive]}
                  onPress={() => setRoomIcon(icon)}
                >
                  <Text style={styles.iconOptionText}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={styles.modalInput}
              placeholder="Rummets navn (f.eks. Stue)"
              placeholderTextColor="#64748b"
              value={roomName}
              onChangeText={setRoomName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Beskrivelse (valgfrit)"
              placeholderTextColor="#64748b"
              value={roomDesc}
              onChangeText={setRoomDesc}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="MQTT Topic (f.eks. home/stue/sensor)"
              placeholderTextColor="#64748b"
              value={roomTopic}
              onChangeText={setRoomTopic}
              autoCapitalize="none"
            />
            <Text style={styles.mqttHint}>💡 {`{"temperature": 22.5, "humidity": 65}`}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCreateRoom(false)}>
                <Text style={styles.modalCancelText}>Annuller</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleCreateRoom} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Opret</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; color: string }> = {
    owner: { label: "Ejer", color: "#f59e0b" },
    member: { label: "Medlem", color: "#3b82f6" },
    viewer: { label: "Gæst", color: "#6b7280" },
  };
  const badge = map[role] || map.viewer;
  return (
    <View style={[styles.roleBadge, { backgroundColor: badge.color + "22", borderColor: badge.color + "55" }]}>
      <Text style={[styles.roleBadgeText, { color: badge.color }]}>{badge.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  inviteBanner: {
    margin: 16, backgroundColor: "#1e293b", borderRadius: 14, padding: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#334155",
  },
  inviteLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  inviteCode: { fontSize: 24, fontWeight: "800", color: "#3b82f6", letterSpacing: 4, marginTop: 2 },
  shareText: { fontSize: 14, color: "#94a3b8" },
  tabRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, gap: 8 },
  tabs: {
    flex: 1, flexDirection: "row",
    backgroundColor: "#1e293b", borderRadius: 12, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: "#334155" },
  tabText: { color: "#64748b", fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: "#f1f5f9" },
  manageBtn: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: "#1e293b",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#334155",
  },
  manageBtnText: { fontSize: 20 },
  content: { flex: 1 },
  section: { padding: 16, gap: 12 },
  roomCard: {
    backgroundColor: "#1e293b", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#334155", gap: 12,
  },
  roomHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  roomEmoji: { fontSize: 28 },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 16, fontWeight: "700", color: "#f1f5f9" },
  roomTopic: { fontSize: 12, color: "#64748b", marginTop: 2 },
  deleteRoomBtn: { padding: 4 },
  deleteRoomBtnText: { fontSize: 18 },
  sensorRow: { flexDirection: "row", gap: 12 },
  sensorBox: {
    flex: 1, backgroundColor: "#0f172a", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#1e293b",
  },
  sensorBoxRight: {},
  sensorLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  sensorValue: { fontSize: 24, fontWeight: "800", color: "#f1f5f9", marginTop: 4 },
  lastUpdate: { fontSize: 11, color: "#475569" },
  addRoomBtn: {
    borderWidth: 2, borderStyle: "dashed", borderColor: "#334155",
    borderRadius: 16, padding: 16, alignItems: "center",
  },
  addRoomBtnText: { color: "#64748b", fontWeight: "600", fontSize: 15 },
  emptySection: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#f1f5f9" },
  emptyText: { fontSize: 14, color: "#64748b", textAlign: "center" },
  memberCard: {
    backgroundColor: "#1e293b", borderRadius: 16, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: "#334155",
  },
  memberAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#3b82f6", alignItems: "center", justifyContent: "center",
  },
  memberAvatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: "600", color: "#f1f5f9" },
  memberEmail: { fontSize: 12, color: "#64748b", marginTop: 2 },
  memberRight: { alignItems: "flex-end", gap: 4 },
  memberEditHint: { fontSize: 10, color: "#475569" },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  roleBadgeText: { fontSize: 12, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: "#1e293b", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#f1f5f9" },
  modalSubtitle: { fontSize: 13, color: "#64748b" },
  sheetItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  sheetItemActive: { opacity: 0.7 },
  sheetItemIcon: { fontSize: 20, width: 28 },
  sheetItemText: { fontSize: 16, color: "#f1f5f9", fontWeight: "500" },
  sheetItemSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  sheetDivider: { height: 1, backgroundColor: "#334155", marginVertical: 4 },
  checkmark: { fontSize: 18, color: "#3b82f6", fontWeight: "700" },
  danger: { color: "#ef4444" },
  iconPicker: { marginBottom: 4 },
  iconOption: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: "#0f172a",
    alignItems: "center", justifyContent: "center", marginRight: 8,
    borderWidth: 2, borderColor: "transparent",
  },
  iconOptionActive: { borderColor: "#3b82f6" },
  iconOptionText: { fontSize: 22 },
  modalInput: {
    backgroundColor: "#0f172a", borderRadius: 12, padding: 14,
    color: "#f1f5f9", fontSize: 16, borderWidth: 1, borderColor: "#334155",
  },
  mqttHint: { fontSize: 12, color: "#475569" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#0f172a",
    alignItems: "center", borderWidth: 1, borderColor: "#334155",
  },
  modalCancelText: { color: "#64748b", fontWeight: "600" },
  modalConfirm: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#3b82f6", alignItems: "center" },
  modalConfirmText: { color: "#fff", fontWeight: "700" },
});
