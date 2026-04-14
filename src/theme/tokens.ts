/**
 * Design system tokens — single source of truth for all visual constants.
 * Dark-first palette with gradient accents.
 */

export const Colors = {
  // Primary palette
  primary: '#6C5CE7',
  primaryLight: '#A29BFE',
  primaryDark: '#5A4BD1',

  // Accent palette
  accent: '#0984E3',
  accentLight: '#74B9FF',
  coral: '#FD79A8',
  coralLight: '#FDCB6E',
  emerald: '#00B894',
  amber: '#FDCB6E',

  // Gradients (defined as tuples for LinearGradient)
  gradientPrimary: ['#6C5CE7', '#A29BFE'] as const,
  gradientAccent: ['#0984E3', '#00B894'] as const,
  gradientCoral: ['#FD79A8', '#FDCB6E'] as const,
  gradientStory: ['#FDCB6E', '#FD79A8', '#6C5CE7'] as const,
  gradientDark: ['#0A0A0F', '#121218'] as const,

  // Dark theme
  dark: {
    background: '#0A0A0F',
    surface: '#121218',
    surfaceElevated: '#1A1A24',
    surfaceHover: '#222232',
    border: '#2A2A3A',
    borderLight: '#1E1E2E',
    text: '#FFFFFF',
    textSecondary: '#A0A0B4',
    textTertiary: '#6A6A80',
    textInverse: '#0A0A0F',
    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.4)',
  },

  // Light theme
  light: {
    background: '#F8F9FA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHover: '#F0F0F5',
    border: '#E8E8EE',
    borderLight: '#F0F0F5',
    text: '#1A1A2E',
    textSecondary: '#6A6A80',
    textTertiary: '#A0A0B4',
    textInverse: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.2)',
  },

  // Semantic
  success: '#00B894',
  warning: '#FDCB6E',
  error: '#E17055',
  info: '#0984E3',

  // Social
  like: '#E17055',
  likeFilled: '#FF6B6B',

  // Transparent
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const Typography = {
  fontFamily: {
    regular: 'Inter_400Regular' as string,
    medium: 'Inter_500Medium' as string,
    semiBold: 'Inter_600SemiBold' as string,
    bold: 'Inter_700Bold' as string,
    extraBold: 'Inter_800ExtraBold' as string,
  },
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    xxl: 32,
    hero: 40,
  },
  lineHeight: {
    xs: 14,
    sm: 18,
    base: 22,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 40,
    hero: 48,
  },
} as const;

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  massive: 64,
} as const;

export const Radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  }),
} as const;

export const IconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
  xxl: 40,
} as const;

export const HitSlop = {
  sm: { top: 8, bottom: 8, left: 8, right: 8 },
  md: { top: 12, bottom: 12, left: 12, right: 12 },
  lg: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;

/** Avatar size presets */
export const AvatarSizes = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
  xxl: 120,
} as const;
