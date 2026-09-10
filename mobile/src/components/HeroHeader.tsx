import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface HeroHeaderProps {
  /** Small line above the title, e.g. a greeting. Uses the light-green tone, not white,
   *  so it reads as secondary against the title without needing a second font weight. */
  eyebrow?: string;
  title: string;
  /** Line below the title, e.g. a one-sentence explainer of what the screen shows. */
  subtitle?: string;
  /** Usually a HeroIconButton (bell, edit, back...). */
  right?: React.ReactNode;
  /** Extra content rendered below the title row, still inside the green panel — e.g.
   *  Profile's avatar/name/role badge. */
  children?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * The solid brand-green, rounded-bottom panel behind every top-level screen's title —
 * first built for Menu, now the shared header for every customer screen so the app reads
 * as one product with a consistent identity rather than a green home screen followed by
 * plain white ones. Screens using this should render it *outside* their scrolling content
 * (see MenuScreen) so it stays put while the body scrolls under it.
 */
export function HeroHeader({ eyebrow, title, subtitle, right, children, style }: HeroHeaderProps) {
  return (
    <View style={[styles.hero, style]}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={[typography.h1, styles.title]}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** The round white icon button that sits in a HeroHeader's `right` slot (bell, edit...). */
export function HeroIconButton({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      style={styles.iconButton}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  textCol: { flex: 1 },
  eyebrow: { ...typography.bodySmall, fontWeight: '700', color: colors.primaryLight, marginBottom: 2 },
  title: { color: colors.textOnPrimary },
  subtitle: { ...typography.bodySmall, color: colors.primaryLight, marginTop: 2 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
