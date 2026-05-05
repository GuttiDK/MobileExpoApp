import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("auth_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}

// Auth
export const api = {
  auth: {
    register: (name: string, email: string, password: string) =>
      request<{ user: User; token: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ user: User; token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
  },

  houses: {
    list: () => request<{ houses: House[] }>("/houses"),
    get: (id: number) =>
      request<{ house: House; members: Member[]; rooms: Room[] }>(`/houses/${id}`),
    create: (name: string, description?: string) =>
      request<{ house: House }>("/houses", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      }),
    update: (id: number, data: { name?: string; description?: string }) =>
      request<{ house: House }>(`/houses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    join: (invite_code: string) =>
      request<{ message: string; house_id: number; house_name: string }>("/houses/join", {
        method: "POST",
        body: JSON.stringify({ invite_code }),
      }),
    regenerateInvite: (id: number) =>
      request<{ invite_code: string }>(`/houses/${id}/regenerate-invite`, { method: "POST" }),
    leave: (id: number) =>
      request<{ message: string }>(`/houses/${id}/leave`, { method: "DELETE" }),
    delete: (id: number) =>
      request<{ message: string }>(`/houses/${id}`, { method: "DELETE" }),
    updateMemberRole: (houseId: number, userId: number, role: string) =>
      request(`/houses/${houseId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    removeMember: (houseId: number, userId: number) =>
      request(`/houses/${houseId}/members/${userId}`, { method: "DELETE" }),
  },

  rooms: {
    create: (data: CreateRoomData) =>
      request<{ room: Room }>("/rooms", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: Partial<CreateRoomData>) =>
      request<{ room: Room }>(`/rooms/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<{ message: string }>(`/rooms/${id}`, { method: "DELETE" }),
    history: (id: number, limit?: number) =>
      request<{ readings: SensorReading[] }>(`/rooms/${id}/history?limit=${limit || 50}`),
  },

  sensors: {
    latest: () => request<{ readings: LatestReading[] }>("/sensors/latest"),
    post: (roomId: number, temperature?: number, humidity?: number) =>
      request<{ reading: SensorReading }>(`/sensors/${roomId}`, {
        method: "POST",
        body: JSON.stringify({ temperature, humidity }),
      }),
  },

  admin: {
    getUserHouses: (userId: number) =>
      request<{ houses: AdminUserHouse[] }>(`/admin/users/${userId}/houses`),
    getUsers: () => request<{ users: AdminUser[] }>("/admin/users"),
    resetPassword: (userId: number, password: string) =>
      request<{ ok: boolean }>(`/admin/users/${userId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      }),
    getRooms: () => request<{ rooms: AdminRoom[] }>("/admin/rooms"),
    updateRoom: (id: number, data: { name?: string; description?: string | null; icon?: string; mqtt_topic?: string | null }) =>
      request<{ room: AdminRoom }>(`/admin/rooms/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    generateData: (roomId: number, count: number, temperature?: number, humidity?: number) =>
      request<{ count: number }>(`/admin/rooms/${roomId}/generate`, {
        method: "POST",
        body: JSON.stringify({ count, ...(temperature !== undefined ? { temperature } : {}), ...(humidity !== undefined ? { humidity } : {}) }),
      }),
  },
};

// Types
export interface User {
  id: number;
  name: string;
  email: string;
  is_admin?: boolean;
  created_at?: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface AdminUserHouse {
  id: number;
  name: string;
  description: string | null;
  invite_code: string;
  owner_name: string;
  user_role: string;
  member_count: number;
  room_count: number;
  created_at: string;
}

export interface AdminRoom {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  mqtt_topic: string | null;
  house_id: number;
  house_name: string;
}

export interface House {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  owner_name: string;
  invite_code: string;
  my_role: "owner" | "member" | "viewer";
  member_count: number;
  created_at: string;
}

export interface Member {
  id: number;
  name: string;
  email: string;
  role: "owner" | "member" | "viewer";
  joined_at: string;
}

export interface Room {
  id: number;
  house_id: number;
  name: string;
  description?: string;
  icon: string;
  mqtt_topic: string;
  last_temperature?: number;
  last_humidity?: number;
  last_reading_at?: string;
  created_at: string;
}

export interface SensorReading {
  id?: number;
  room_id?: number;
  temperature?: number;
  humidity?: number;
  recorded_at: string;
}

export interface LatestReading {
  room_id: number;
  room_name: string;
  house_name: string;
  temperature?: number;
  humidity?: number;
  recorded_at?: string;
}

export interface CreateRoomData {
  house_id: number;
  name: string;
  description?: string;
  icon?: string;
  mqtt_topic: string;
}
