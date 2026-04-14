import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { Colors, Typography, Spacing } from '../src/theme/tokens';
import GradientButton from '../src/components/GradientButton';

export default function NotFoundScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Ionicons name="alert-circle-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.title, { color: colors.text }]}>Page Not Found</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        The page you're looking for doesn't exist.
      </Text>
      <GradientButton title="Go Home" onPress={() => router.replace('/(tabs)')} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },
  title: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xl, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  subtitle: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, textAlign: 'center', marginBottom: Spacing.xxl },
  button: { minWidth: 160 },
});
