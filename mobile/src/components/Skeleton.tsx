import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/** A single shimmering placeholder block. Compose a few of these to build a skeleton for
 *  any card shape instead of falling back to a blank screen or a spinner for list content. */
export function Skeleton({ width = '100%', height = 16, borderRadius: r = radius.sm, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: r, backgroundColor: colors.surfaceContainer, opacity: pulse },
        style,
      ]}
    />
  );
}

/** Skeleton matching the food-card grid shape in Menu — shown in place of the real grid
 *  while the first fetch is in flight, so the layout doesn't jump once data arrives. */
export function FoodCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={110} borderRadius={radius.md} style={{ marginBottom: spacing.sm }} />
      <Skeleton width="80%" height={14} style={{ marginBottom: spacing.xs }} />
      <Skeleton width="50%" height={12} style={{ marginBottom: spacing.md }} />
      <Skeleton width="60%" height={32} borderRadius={radius.full} />
    </View>
  );
}

export function MenuGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <FoodCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
});
