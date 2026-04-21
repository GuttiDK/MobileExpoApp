// src/components/AlarmBanner.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius } from '../utils/theme';

interface AlarmBannerProps {
  alarms: string[];
}

export function AlarmBanner({ alarms }: AlarmBannerProps) {
  if (!alarms.length) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚠️ ALARM AKTIV</Text>
      {alarms.map((alarm, i) => (
        <Text key={i} style={styles.alarm}>{alarm}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    color: '#FF6B6B',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  alarm: {
    color: '#FFB3B3',
    fontSize: 13,
    marginTop: 2,
  },
});
