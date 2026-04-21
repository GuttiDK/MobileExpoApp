// src/components/MetricCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../utils/theme';

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  icon: string;
  color: string;
  glowColor: string;
  subValue?: string;
}

export function MetricCard({
  label, value, unit, icon, color, glowColor, subValue
}: MetricCardProps) {
  return (
    <View style={[styles.card, { borderColor: color, shadowColor: color }]}>
      <View style={[styles.glowBg, { backgroundColor: glowColor }]} />
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        <Text style={[styles.unit, { color }]}>{unit}</Text>
      </View>
      {subValue ? (
        <Text style={styles.subValue}>{subValue}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#161B22',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  glowBg: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.6,
  },
  icon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 11,
    color: '#8B949E',
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 2,
    opacity: 0.8,
  },
  subValue: {
    fontSize: 12,
    color: '#8B949E',
    marginTop: spacing.xs,
  },
});
