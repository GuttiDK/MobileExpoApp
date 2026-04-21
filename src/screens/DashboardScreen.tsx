// src/screens/DashboardScreen.tsx
import React from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';

import { useTelemetryViewModel } from '../viewmodels/TelemetryViewModel';
import { MetricCard } from '../components/MetricCard';
import { SensorChart } from '../components/SensorChart';
import { TimeRangePicker } from '../components/TimeRangePicker';
import { RoomPicker } from '../components/RoomPicker';
import { VentilationButton } from '../components/VentilationButton';
import { AlarmBanner } from '../components/AlarmBanner';
import { NetworkStatusBar } from '../components/NetworkStatusBar';
import { colors, spacing, radius } from '../utils/theme';

export default function DashboardScreen() {
  const vm = useTelemetryViewModel();

  const selectedRoom = vm.rooms.find((r) => r.id === vm.selectedRoomId);
  const latest = vm.latestReading;

  const latestTimeStr = latest
    ? format(new Date(latest.timestamp), "d. MMM yyyy 'kl.' HH:mm:ss", { locale: da })
    : '—';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>TELEMETRI</Text>
          <Text style={styles.headerSub}>
            {selectedRoom?.name ?? '—'} · {selectedRoom?.description ?? ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={vm.refresh}
          disabled={vm.appState.isLoading}
        >
          {vm.appState.isLoading
            ? <ActivityIndicator size="small" color={colors.accent} />
            : <Text style={styles.refreshIcon}>↻</Text>}
        </TouchableOpacity>
      </View>

      {/* Network status */}
      <NetworkStatusBar
        isOnline={vm.appState.isOnline}
        lastUpdated={vm.appState.lastUpdated}
        error={vm.appState.error}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={vm.appState.isLoading}
            onRefresh={vm.refresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Room picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>VÆLG RUM</Text>
          <RoomPicker
            rooms={vm.rooms}
            selectedRoomId={vm.selectedRoomId}
            onSelect={vm.selectRoom}
          />
        </View>

        {/* Alarm banner */}
        <AlarmBanner alarms={vm.activeAlarms} />

        {/* Current readings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AKTUEL MÅLING</Text>
          <Text style={styles.timestamp}>📅 {latestTimeStr}</Text>
          <View style={styles.metricsRow}>
            <MetricCard
              label="Temperatur"
              value={latest ? `${latest.temperature}` : '—'}
              unit="°C"
              icon="🌡️"
              color={colors.accent}
              glowColor={colors.accentGlow}
              subValue={vm.summary
                ? `Min ${vm.summary.minTemp}° · Max ${vm.summary.maxTemp}° · Gns ${vm.summary.avgTemp}°`
                : undefined}
            />
            <MetricCard
              label="Luftfugtighed"
              value={latest ? `${latest.humidity}` : '—'}
              unit="%"
              icon="💧"
              color={colors.humidity}
              glowColor={colors.humidityGlow}
              subValue={vm.summary
                ? `Min ${vm.summary.minHumidity}% · Max ${vm.summary.maxHumidity}% · Gns ${vm.summary.avgHumidity}%`
                : undefined}
            />
          </View>
        </View>

        {/* Time range picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TIDSINTERVAL</Text>
          <TimeRangePicker
            selected={vm.selectedRange}
            onChange={vm.setSelectedRange}
          />
        </View>

        {/* Charts */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GRAFER</Text>
          <SensorChart
            title="Temperatur"
            unit="°C"
            data={vm.temperatureChartData}
            color={colors.accent}
            startFillColor={colors.accent}
            endFillColor="transparent"
            icon="🌡️"
            isLoading={vm.appState.isLoading && vm.temperatureChartData.length === 0}
          />
          <SensorChart
            title="Luftfugtighed"
            unit="%"
            data={vm.humidityChartData}
            color={colors.humidity}
            startFillColor={colors.humidity}
            endFillColor="transparent"
            icon="💧"
            isLoading={vm.appState.isLoading && vm.humidityChartData.length === 0}
          />
        </View>

        {/* Ventilation control */}
        <VentilationButton
          isOpen={vm.appState.isVentilationOpen}
          onToggle={vm.toggleVentilation}
          roomName={selectedRoom?.name ?? ''}
        />

        {/* Error message if present */}
        {vm.appState.error && vm.appState.isOnline && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {vm.appState.error}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  headerTitle: {
    color: '#E6EDF3',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },
  headerSub: {
    color: '#8B949E',
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    color: '#00D4FF',
    fontSize: 20,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: '#484F58',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  timestamp: {
    color: '#8B949E',
    fontSize: 12,
    marginBottom: spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    marginHorizontal: -spacing.xs,
  },
  errorBox: {
    backgroundColor: 'rgba(249,168,37,0.1)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#F9A825',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: '#F9A825',
    fontSize: 13,
  },
});
