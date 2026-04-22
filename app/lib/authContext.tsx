import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, User } from "./api";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("auth_token");
      const userJson = await AsyncStorage.getItem("auth_user");
      if (token && userJson) {
        setState({ user: JSON.parse(userJson), token, loading: false });
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    await AsyncStorage.setItem("auth_token", res.token);
    await AsyncStorage.setItem("auth_user", JSON.stringify(res.user));
    setState({ user: res.user, token: res.token, loading: false });
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.auth.register(name, email, password);
    await AsyncStorage.setItem("auth_token", res.token);
    await AsyncStorage.setItem("auth_user", JSON.stringify(res.user));
    setState({ user: res.user, token: res.token, loading: false });
  };

  const logout = async () => {
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("auth_user");
    setState({ user: null, token: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
