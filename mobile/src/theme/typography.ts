import { TextStyle } from 'react-native';
import { colors } from './colors';

/**
 * Font family names as registered by useFonts() in App.tsx.
 *
 * React Native has no synthetic bolding for custom fonts — setting fontWeight:'700' on a
 * Regular face silently does nothing on Android — so each weight is loaded as its own
 * family and weight is chosen by picking the right entry here rather than via fontWeight.
 */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

/**
 * One type scale for the whole app, matching the design system's named styles. Pick a
 * variant by name rather than setting fontSize/fontFamily inline, so headings are the same
 * size everywhere they appear.
 */
export const typography: Record<string, TextStyle> = {
  // display-lg — 32/40 ExtraBold, -0.02em tracking
  display: {
    fontFamily: fonts.extraBold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.64,
    color: colors.textPrimary,
  },
  // headline-lg — 24/32 Bold, -0.01em
  h1: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.24,
    color: colors.textPrimary,
  },
  // headline-md — 20/28 Bold
  h2: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28, color: colors.textPrimary },
  // In-card heading, one step below headline-md
  h3: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.textPrimary },
  // body-lg — 16/24
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.textPrimary },
  bodyMedium: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 24, color: colors.textPrimary },
  // body-md — 14/20
  bodySmall: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  // label-lg — 14/20 SemiBold
  label: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 20, color: colors.textPrimary },
  // label-sm — 12/16 SemiBold, for status chips and micro-copy
  caption: { fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  button: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 20 },
  // overline — 11/14 ExtraBold, wide tracking, uppercase. Small section labels above a
  // heading ("MEAL OF THE DAY") rather than a full h2 for every subsection.
  eyebrow: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    color: colors.primaryDark,
  },
  // price-lg — for the one hero price on a detail/checkout screen; card prices keep using
  // an inline size next to `label` as before.
  priceLarge: { fontFamily: fonts.extraBold, fontSize: 22, lineHeight: 28, color: colors.textPrimary },
};
