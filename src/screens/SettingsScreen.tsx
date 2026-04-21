// src/screens/SettingsScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Switch, ScrollView,
  TouchableOpacity, TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTelemetryViewModel } from '../viewmodels/TelemetryViewModel';
import { AlarmConfig } from '../models/TelemetryModels';
import { colors, spacing, radius } from '../utils/theme';

export default function SettingsScreen() {
  const vm = useTelemetryViewModel();
  const [localAlarm, setLocalAlarm] = useState<AlarmConfig>(vm.alarmConfig);

  const handleSave = async () => {
    await vm.updateAlarmConfig(localAlarm);
    Alert.alert('Gemt', 'Alarmindstillinger er gemt.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>INDSTILLINGER</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Alarm config */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>⚠️ Temperaturalarm</Text>
            <Switch
              value={localAlarm.enabled}
              onValueChange={(v) => setLocalAlarm((a) => ({ ...a, enabled: v }))}
              trackColor={{ false: '#30363D', true: 'rgba(0,212,255,0.4)' }}
              thumbColor={localAlarm.enabled ? '#00D4FF' : '#484F58'}
            />
          </View>
          <Text style={styles.cardDesc}>
            Få besked når temperatur eller luftfugtighed går uden for de definerede grænser.
          </Text>

          <View style={styles.inputGroup}>
            <LimitInput
              label="Min temperatur (°C)"
              value={localAlarm.minTemperature}
              onChange={(v) => setLocalAlarm((a) => ({ ...a, minTemperature: v }))}
              enabled={localAlarm.enabled}
            />
            <LimitInput
              label="Max temperatur (°C)"
              value={localAlarm.maxTemperature}
              onChange={(v) => setLocalAlarm((a) => ({ ...a, maxTemperature: v }))}
              enabled={localAlarm.enabled}
            />
            <LimitInput
              label="Min luftfugtighed (%)"
              value={localAlarm.minHumidity}
              onChange={(v) => setLocalAlarm((a) => ({ ...a, minHumidity: v }))}
              enabled={localAlarm.enabled}
            />
            <LimitInput
              label="Max luftfugtighed (%)"
              value={localAlarm.maxHumidity}
              onChange={(v) => setLocalAlarm((a) => ({ ...a, maxHumidity: v }))}
              enabled={localAlarm.enabled}
            />
          </View>
        </View>

        {/* App info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ℹ️ Om appen</Text>
          <InfoRow label="App" value="TelemetryApp v1.0" />
          <InfoRow label="Data" value="Simuleret via FakerJS seed" />
          <InfoRow label="Arkitektur" value="MVVM + Dependency Injection" />
          <InfoRow label="Offline" value="AsyncStorage cache" />
          <InfoRow label="Framework" value="Expo / React Native" />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>GEM INDSTILLINGER</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function LimitInput({
  label, value, onChange, enabled
}: {
  label: string; value: number; onChange: (v: number) => void; enabled: boolean;
}) {
  return (
    <View style={styles.limitRow}>
      <Text style={[styles.limitLabel, !enabled && { opacity: 0.4 }]}>{label}</Text>
      <TextInput
        style={[styles.limitInput, !enabled && { opacity: 0.4 }]}
        value={String(value)}
        onChangeText={(t) => {
          const n = parseFloat(t);
          if (!isNaN(n)) onChange(n);
        }}
        keyboardType="numeric"
        editable={enabled}
        placeholderTextColor="#484F58"
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D1117' },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  headerTitle: {
    color: '#E6EDF3',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },
  content: { padding: spacing.md, paddingBottom: 60 },
  card: {
    backgroundColor: '#161B22',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#30363D',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: { color: '#E6EDF3', fontSize: 15, fontWeight: '700' },
  cardDesc: { color: '#8B949E', fontSize: 12, lineHeight: 18, marginBottom: spacing.md },
  inputGroup: { gap: spacing.sm },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  limitLabel: { color: '#8B949E', fontSize: 13, flex: 1 },
  limitInput: {
    color: '#00D4FF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    width: 60,
    backgroundColor: '#21262D',
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  infoLabel: { color: '#8B949E', fontSize: 13 },
  infoValue: { color: '#484F58', fontSize: 13 },
  saveBtn: {
    backgroundColor: 'rgba(0,212,255,0.12)',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: '#00D4FF',
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnText: { color: '#00D4FF', fontWeight: '800', fontSize: 14, letterSpacing: 1.5 },
});
