/**
 * Single color palette for the whole app. Every screen pulls from here instead of
 * hardcoding hex values, which is what keeps the app looking like one product instead of
 * a pile of independently-styled screens.
 *
 * Values come verbatim from the TuckZone design system (DESIGN.md) — a "Vibrant
 * Professional" palette built on emerald green over a cool off-white surface. The names
 * below map to the Material-style tokens in that file; the app's older semantic names are
 * kept as aliases so every existing screen keeps compiling against one source of truth.
 */
export const colors = {
  // Brand — emerald green carries every primary action
  primary: '#006948', // primary
  primaryDark: '#005137', // on-primary-fixed-variant — pressed states
  primaryLight: '#85f8c4', // primary-fixed — chips, subtle highlights
  primarySurface: '#eef4ff', // surface-container-low — tinted panels

  // Surfaces (tonal layers)
  background: '#f8f9ff', // surface / background
  surface: '#ffffff', // surface-container-lowest — cards
  surfaceLow: '#eef4ff', // surface-container-low — info boxes
  surfaceContainer: '#e5eeff', // surface-container — thumbnails, avatars
  surfaceHigh: '#dfe9fa', // surface-container-high

  // Outlines — the design separates static content with 1px borders rather than shadows
  border: '#bccac0', // outline-variant
  borderLight: '#d9e3f4', // surface-variant
  outline: '#6d7a72', // outline

  // Text
  textPrimary: '#121c28', // on-surface
  textSecondary: '#3d4a42', // on-surface-variant
  textTertiary: '#6d7a72', // outline — muted and placeholder text
  textOnPrimary: '#ffffff', // on-primary

  // Semantic. Status chips follow the design's soft-background / dark-text pairing.
  success: '#065f46',
  successLight: '#d1fae5',
  danger: '#ba1a1a', // error
  dangerLight: '#ffdad6', // error-container
  dangerDark: '#93000a', // on-error-container
  warning: '#92400e',
  warningLight: '#fef3c7',
  info: '#575e70', // secondary
  infoLight: '#d9dff5', // secondary-container

  // Overlays
  overlay: 'rgba(18, 28, 40, 0.45)',
  shadow: '#121c28',
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
