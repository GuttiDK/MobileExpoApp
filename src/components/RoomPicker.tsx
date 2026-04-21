// src/components/RoomPicker.tsx
import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Room } from '../models/TelemetryModels';
import { colors, spacing, radius } from '../utils/theme';

interface RoomPickerProps {
  rooms: Room[];
  selectedRoomId: string;
  onSelect: (roomId: string) => void;
}

const ROOM_ICONS: Record<string, string> = {
  'room-1': '🛋️',
  'room-2': '🛏️',
  'room-3': '🍳',
  'room-4': '💻',
};

export function RoomPicker({ rooms, selectedRoomId, onSelect }: RoomPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {rooms.map((room) => {
        const isSelected = room.id === selectedRoomId;
        return (
          <TouchableOpacity
            key={room.id}
            style={[styles.chip, isSelected && styles.chipActive]}
            onPress={() => onSelect(room.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{ROOM_ICONS[room.id] ?? '📍'}</Text>
            <Text style={[styles.label, isSelected && styles.labelActive]}>
              {room.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: radius.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#30363D',
    gap: spacing.xs,
  },
  chipActive: {
    borderColor: '#00D4FF',
    backgroundColor: 'rgba(0,212,255,0.1)',
  },
  icon: {
    fontSize: 16,
  },
  label: {
    color: '#8B949E',
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    color: '#00D4FF',
  },
});
