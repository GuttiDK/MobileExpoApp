import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useAuth } from "../lib/authContext";

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password || (mode === "register" && !name)) {
      Alert.alert("Fejl", "Udfyld alle felter");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password);
      }
    } catch (err: any) {
      Alert.alert("Fejl", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {/* Logo / Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🏠</Text>
          <Text style={styles.title}>HomeApp</Text>
          <Text style={styles.subtitle}>Smart Home Monitor</Text>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === "login" && styles.tabActive]}
            onPress={() => setMode("login")}
          >
            <Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>
              Log ind
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === "register" && styles.tabActive]}
            onPress={() => setMode("register")}
          >
            <Text style={[styles.tabText, mode === "register" && styles.tabTextActive]}>
              Opret konto
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === "register" && (
            <TextInput
              style={styles.input}
              placeholder="Dit navn"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Adgangskode"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === "login" ? "Log ind" : "Opret konto"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  inner: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#f1f5f9",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: "#3b82f6",
  },
  tabText: {
    color: "#64748b",
    fontWeight: "600",
    fontSize: 14,
  },
  tabTextActive: {
    color: "#fff",
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    color: "#f1f5f9",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
