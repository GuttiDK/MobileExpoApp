// src/components/StatusBar.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import { spacing } from '../utils/theme';

interface StatusBarProps {
  isOnline: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

export function NetworkStatusBar({ isOnline, lastUpdated, error }: StatusBarProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: isOnline ? '#3FB950' : '#FF6B6B' }]} />
      <Text style={styles.text}>
        {isOnline ? 'Online' : 'Offline'}
        {lastUpdated
          ? ` · Opdateret ${format(lastUpdated, 'HH:mm:ss', { locale: da })}`
          : ''}
      </Text>
      {error && !isOnline ? (
        <Text style={styles.error}> · {error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  text: {
    color: '#8B949E',
    fontSize: 11,
    fontWeight: '500',
  },
  error: {
    color: '#FF6B6B',
    fontSize: 11,
  },
});
