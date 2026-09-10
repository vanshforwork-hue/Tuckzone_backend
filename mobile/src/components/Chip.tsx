import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  dotColor?: string;
}

/** Filter/selection pill (menu food-type filters, category filters, status filters,
 *  admin tabs). One shape and one active/inactive state used everywhere they appear. */
export function Chip({ label, active, onPress, dotColor }: ChipProps) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
      >
        {dotColor ? <Text style={[styles.dot, { color: dotColor }]}>●</Text> : null}
        <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  chipInactive: { backgroundColor: colors.surface, borderColor: colors.border },
  label: { ...typography.label, fontSize: 14 },
  labelActive: { color: colors.textOnPrimary },
  labelInactive: { color: colors.textSecondary },
  dot: { fontSize: 10 },
});
