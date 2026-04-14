import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * Stack layout for detail screens — slides in from right.
 */
export default function ScreensLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
