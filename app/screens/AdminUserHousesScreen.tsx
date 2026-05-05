import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, AdminUserHouse } from "../lib/api";

const ROLE_LABELS: Record<string, string> = {
  owner: "Ejer",
  member: "Medlem",
  viewer: "Gæst",
};

export default function AdminUserHousesScreen({ route, navigation }: any) {
  const { userId, userName } = route.params;
  const [houses, setHouses] = useState<AdminUserHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.admin.getUserHouses(userId);
      setHouses(res.houses);
      navigation.setOptions({ title: `${userName}s huse` });
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, userName]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={houses}
      keyExtractor={(h) => h.id.toString()}
      contentContainerStyle={[styles.list, houses.length === 0 && styles.emptyContainer]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor="#3b82f6"
        />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🏠</Text>
          <Text style={styles.emptyTitle}>Ingen huse</Text>
          <Text style={styles.emptyText}>{userName} er ikke medlem af nogen huse.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.75}
          onPress={() =>
            navigation.navigate("HouseDetail", {
              houseId: item.id,
              houseName: item.name,
            })
          }
        >
          <View style={styles.cardTop}>
            <View style={styles.cardMain}>
              <Text style={styles.houseName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.houseDesc} numberOfLines={1}>{item.description}</Text>
              ) : null}
            </View>
            <RoleBadge role={item.user_role} />
          </View>

          <View style={styles.cardMeta}>
            <MetaPill icon="👤" label={item.owner_name} />
            <MetaPill icon="👥" label={`${item.member_count} ${item.member_count === 1 ? "bruger" : "brugere"}`} />
            <MetaPill icon="🏠" label={`${item.room_count} ${item.room_count === 1 ? "rum" : "rum"}`} />
          </View>

          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}
    />
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    owner: "#f59e0b",
    member: "#3b82f6",
    viewer: "#6b7280",
  };
  const color = colors[role] ?? "#6b7280";
  const label = ROLE_LABELS[role] ?? role;
  return (
    <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color + "55" }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function MetaPill({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillIcon}>{icon}</Text>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 8 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#f1f5f9" },
  emptyText: { fontSize: 14, color: "#64748b", textAlign: "center" },

  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardMain: { flex: 1 },
  houseName: { fontSize: 16, fontWeight: "700", color: "#f1f5f9" },
  houseDesc: { fontSize: 13, color: "#64748b", marginTop: 2 },
  chevron: { fontSize: 22, color: "#475569", alignSelf: "center" },

  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#0f172a", borderRadius: 20, borderWidth: 1,
    borderColor: "#334155", paddingHorizontal: 10, paddingVertical: 4,
  },
  pillIcon: { fontSize: 12 },
  pillText: { fontSize: 12, color: "#94a3b8", fontWeight: "500" },

  badge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: "600" },
});
