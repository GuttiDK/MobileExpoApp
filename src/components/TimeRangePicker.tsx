// src/components/TimeRangePicker.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TimeRange } from '../models/TelemetryModels';
import { colors, spacing, radius } from '../utils/theme';

interface TimeRangePickerProps {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
}

const OPTIONS: { label: string; value: TimeRange }[] = [
  { label: 'Seneste time', value: '1h' },
  { label: 'Seneste dag',  value: '1d' },
  { label: 'Seneste uge',  value: '1w' },
];

export function TimeRangePicker({ selected, onChange }: TimeRangePickerProps) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.btn, selected === opt.value && styles.btnActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, selected === opt.value && styles.labelActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#161B22',
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  btnActive: {
    backgroundColor: 'rgba(0,212,255,0.15)',
    borderWidth: 1,
    borderColor: '#00D4FF',
  },
  label: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '600',
  },
  labelActive: {
    color: '#00D4FF',
  },
});
