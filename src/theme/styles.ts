import { StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Typography, Spacing, Radii, Shadows } from './tokens';

/**
 * Shared style utilities — reusable style fragments
 * for common patterns across the app.
 */

/** Creates a glassmorphism container style */
export function glassStyle(
  backgroundColor: string,
  borderColor: string,
): ViewStyle {
  return {
    backgroundColor,
    borderWidth: 1,
    borderColor,
    borderRadius: Radii.lg,
    ...Shadows.md,
  };
}

/** Row layout with center alignment */
export const row: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
};

/** Row layout with space-between */
export const rowBetween: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
};

/** Center content both axes */
export const center: ViewStyle = {
  alignItems: 'center',
  justifyContent: 'center',
};

/** Full-width fill */
export const fill: ViewStyle = {
  flex: 1,
};

/** Screen container with safe padding */
export function screenContainer(backgroundColor: string): ViewStyle {
  return {
    flex: 1,
    backgroundColor,
  };
}

/** Card container */
export function cardStyle(
  surfaceColor: string,
  borderColor: string,
): ViewStyle {
  return {
    backgroundColor: surfaceColor,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor,
    padding: Spacing.base,
    ...Shadows.sm,
  };
}

/** Text style factories */
export const textStyles = StyleSheet.create({
  hero: {
    fontFamily: Typography.fontFamily.extraBold,
    fontSize: Typography.size.hero,
    lineHeight: Typography.lineHeight.hero,
  } as TextStyle,
  title: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.xl,
    lineHeight: Typography.lineHeight.xl,
  } as TextStyle,
  heading: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
  } as TextStyle,
  subheading: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
  } as TextStyle,
  body: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    lineHeight: Typography.lineHeight.base,
  } as TextStyle,
  bodyMedium: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.size.base,
    lineHeight: Typography.lineHeight.base,
  } as TextStyle,
  caption: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  } as TextStyle,
  captionMedium: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  } as TextStyle,
  micro: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
  } as TextStyle,
});
