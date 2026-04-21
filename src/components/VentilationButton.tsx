// src/components/VentilationButton.tsx
import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { spacing, radius } from '../utils/theme';

interface VentilationButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  roomName: string;
}

export function VentilationButton({ isOpen, onToggle, roomName }: VentilationButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isOpen]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>VENTILATION KONTROL</Text>
      <Text style={styles.roomLabel}>{roomName}</Text>

      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[styles.btn, isOpen ? styles.btnOpen : styles.btnClosed]}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <Text style={styles.btnIcon}>{isOpen ? '🌀' : '💨'}</Text>
          <Text style={[styles.btnText, { color: isOpen ? '#7EE787' : '#00D4FF' }]}>
            {isOpen ? 'VENTILATION ÅBEN' : 'ÅBN VENTILATION'}
          </Text>
          <View style={[styles.indicator, { backgroundColor: isOpen ? '#7EE787' : '#484F58' }]} />
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.hint}>
        {isOpen
          ? 'Vindue/ventilation er aktiveret — tryk for at lukke'
          : 'Tryk for at aktivere ventilationen via simuleret servo'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: '#484F58',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  roomLabel: {
    color: '#8B949E',
    fontSize: 13,
    marginBottom: spacing.md,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  btnClosed: {
    backgroundColor: 'rgba(0,212,255,0.08)',
    borderColor: '#00D4FF',
  },
  btnOpen: {
    backgroundColor: 'rgba(126,231,135,0.08)',
    borderColor: '#7EE787',
  },
  btnIcon: {
    fontSize: 22,
  },
  btnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  hint: {
    color: '#484F58',
    fontSize: 11,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
});
