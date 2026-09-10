import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ShoppingCart } from 'lucide-react-native';
import { useCart } from '../context/CartContext';
import { colors, radius, spacing, typography } from '../theme';

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface FloatingTabBarProps extends BottomTabBarProps {
  icons: Record<string, IconComponent>;
  labels?: Record<string, string>;
}

export function FloatingTabBar({ state, descriptors, navigation, icons, labels }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();

  // Split routes so Cart sits right in the middle
  const totalRoutes = state.routes.length;
  const midPoint = Math.floor(totalRoutes / 2);
  const leftRoutes = state.routes.slice(0, midPoint);
  const rightRoutes = state.routes.slice(midPoint);

  function renderTab(route: (typeof state.routes)[0]) {
    const { options } = descriptors[route.key];
    const index = state.routes.findIndex((r) => r.key === route.key);
    const focused = state.index === index;
    const Icon = icons[route.name];
    const label = labels?.[route.name] ?? (options.tabBarLabel as string) ?? route.name;

    function onPress() {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    }

    if (!Icon) return null;

    return (
      <Pressable key={route.key} onPress={onPress} style={styles.tab} accessibilityRole="button">
        <Icon
          size={22}
          color={focused ? colors.primary : colors.textTertiary}
          strokeWidth={focused ? 2.4 : 2}
        />
        <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
      <View style={styles.bar}>
        {/* Left Side Tabs */}
        {leftRoutes.map(renderTab)}

        {/* Center Cart Button */}
        <View style={styles.centerCartWrap}>
          <Pressable
            onPress={() => navigation.navigate('Checkout' as never)}
            style={({ pressed }) => [styles.cartButton, pressed && styles.cartButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Cart"
          >
            <ShoppingCart size={22} color={colors.textOnPrimary} strokeWidth={2.4} />
            {itemCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{itemCount}</Text>
              </View>
            )}
          </Pressable>
          <Text style={styles.cartLabel}>Cart</Text>
        </View>

        {/* Right Side Tabs */}
        {rightRoutes.map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    paddingTop: spacing.xs,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
  },
  tab: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 4 },
  label: { ...typography.caption, fontSize: 10, marginTop: 2, color: colors.textTertiary },
  labelActive: { color: colors.primary, fontWeight: '800' },

  centerCartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    top: -14,
    marginHorizontal: 4,
  },
  cartButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    position: 'relative',
  },
  cartButtonPressed: { transform: [{ scale: 0.95 }] },
  cartLabel: { ...typography.caption, fontSize: 10, marginTop: 2, color: colors.primary, fontWeight: '800' },

  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.lemon,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText: { color: colors.textPrimary, fontSize: 10, fontWeight: '900' },
});
