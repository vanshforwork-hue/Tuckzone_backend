/**
 * Single color palette for the whole app. Every screen pulls from here instead of
 * hardcoding hex values, which is what keeps the app looking like one product instead of
 * a pile of independently-styled screens.
 *
 * Rebuilt around the actual TuckZone mark (forest green lunchbox + warm gold wordmark, on a
 * warm cream ground, tagline "Good food. Happy mood.") instead of the old cool blue-teal
 * set, which didn't match the brand anywhere else in the product. Green stays the primary
 * action color; gold is the one accent used deliberately (offers, highlights, active states)
 * rather than sprinkled everywhere. Token names are unchanged so every existing screen keeps
 * compiling against the same source of truth.
 */
export const colors = {
  // Brand colors from Stitch design specification
  primary: '#0D6346',
  primaryDark: '#0A4F38', // pressed states / deep headers
  primaryLight: '#D6F0DF', // chips, subtle highlights
  primarySurface: '#EAF4F2', // tinted panels, icon wells
  accentGreen: '#189A63',

  // Stitch Accents
  lemon: '#FFDF6D',
  lemonLight: '#FFF6D6',
  accent: '#FF9E3B',
  accentDark: '#D97706',
  accentLight: '#FEF3C7',

  // Pastel set — quick-action tiles and playful decorative chrome
  pastelYellow: '#FEF08A',
  pastelYellowFg: '#854D0E',
  pastelPink: '#FBCFE8',
  pastelPinkFg: '#9D174D',
  pastelBlue: '#BAE6FD',
  pastelBlueFg: '#0369A1',
  pastelMint: '#D1FAE5',
  pastelMintFg: '#065F46',
  pastelOrange: '#FFEDD5',
  pastelOrangeFg: '#C2410C',

  // Surfaces (tonal layers) — warm cream matching stitch design
  background: '#FDFBF6',
  surface: '#FFFFFF',
  surfaceLow: '#F8FBFA',
  surfaceContainer: '#F1F7F5',
  surfaceHigh: '#E5EFEA',

  // Outlines
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  outline: '#94A3B8',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textOnPrimary: '#FFFFFF',

  // Semantic
  success: '#0D6346',
  successLight: '#D1FAE5',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  dangerDark: '#991B1B',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  info: '#475569',
  infoLight: '#F1F5F9',

  // Overlays
  overlay: 'rgba(15, 23, 42, 0.5)',
  shadow: '#0F172A',
} as const;

/** Maps an order/ordering status word to a semantic color, used for badges everywhere. */
export function statusColor(status: string): { fg: string; bg: string } {
  switch (status) {
    case 'PLACED':
      return { fg: colors.info, bg: colors.infoLight };
    // Not a real OrderStatus value — a pseudo-key callers pass for "payment still
    // pending", which has no dedicated status of its own.
    case 'PENDING':
      return { fg: colors.warning, bg: colors.warningLight };
    case 'DELIVERED':
    case 'ACTIVE':
    case 'OPEN':
      return { fg: colors.success, bg: colors.successLight };
    case 'CANCELLED':
    case 'REJECTED':
    case 'DISABLED':
    case 'CLOSED':
      return { fg: colors.dangerDark, bg: colors.dangerLight };
    default:
      return { fg: colors.textSecondary, bg: colors.borderLight };
  }
}
