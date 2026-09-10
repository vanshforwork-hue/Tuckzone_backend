import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, ShoppingCart } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { formatCurrency } from '../utils/format';

interface CartBarProps {
  itemCount: number;
  total: number;
  /** Name of the most recently added item, shown briefly as confirmation. */
  lastAdded?: string | null;
  onPress: () => void;
}

/**
 * The bottom cart bar, in the shape Swiggy and Zomato use: pinned to the bottom of the
 * menu, showing what is in the cart and a single tap to review it.
 *
 * This replaced a transient "added to cart" pill. The pill only rendered while an animation
 * was mid-flight, so if that animation did not fire the shopper got no feedback at all —
 * which is exactly the bug reported on the All tab. Visibility here is driven purely by
 * `itemCount`, so the bar is on screen whenever the cart has something in it, animation or
 * no animation. The slide-in is decoration on top of correct state, not the mechanism.
 */
export function CartBar({ itemCount, total, lastAdded, onPress }: CartBarProps) {
  const slide = useRef(new Animated.Value(itemCount > 0 ? 1 : 0)).current;
  const bump = useRef(new Animated.Value(1)).current;

  // Kept mounted through the exit animation so the bar can slide out rather than vanish.
  const [mounted, setMounted] = useState(itemCount > 0);

  useEffect(() => {
    if (itemCount > 0) {
      setMounted(true);
      Animated.timing(slide, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slide, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [itemCount, slide]);

  // A small pulse on the count each time it changes, so adding a second portion of
  // something already in the cart still reads as "that worked".
  useEffect(() => {
    if (itemCount === 0) return;
    bump.setValue(0.75);
    Animated.spring(bump, {
      toValue: 1,
      friction: 4,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [itemCount, bump]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: slide,
          transform: [
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) },
          ],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.bar, pressed && styles.barPressed]}
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}, ${formatCurrency(total)}`}
      >
        <Animated.View style={[styles.badge, { transform: [{ scale: bump }] }]}>
          <ShoppingCart size={16} color={colors.textPrimary} />
          <Text style={styles.badgeCount}>{itemCount}</Text>
        </Animated.View>

        <View style={styles.textWrap}>
          <Text style={styles.total}>{formatCurrency(total)}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {lastAdded ? `${lastAdded} added` : `${itemCount} ${itemCount === 1 ? 'item' : 'items'} in cart`}
          </Text>
        </View>

        <View style={styles.cta}>
          <Text style={styles.ctaText}>View Cart</Text>
          <ChevronRight size={18} color={colors.textOnPrimary} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.md,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  barPressed: { opacity: 0.9 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // Gold-on-green is the one deliberate accent moment on this bar — it's the
    // highest-visibility persistent element on the menu screen, so it's where the brand's
    // second color earns its keep.
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  badgeCount: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  textWrap: { flex: 1 },
  total: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 16 },
  subtitle: { color: colors.textOnPrimary, opacity: 0.75, fontSize: 12, marginTop: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ctaText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 14 },
});
