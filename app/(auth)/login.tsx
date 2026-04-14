import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Colors, Typography, Spacing, Radii, Shadows } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/stores/authStore';
import GradientButton from '../../src/components/GradientButton';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const login = useAuthStore((s) => s.login);

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = usernameOrEmail.trim().length >= 3 && password.length >= 6;

  const handleLogin = useCallback(async () => {
    if (!canSubmit || isLoading) return;
    setError('');
    setIsLoading(true);

    try {
      await login(usernameOrEmail.trim(), password);
      // Auth guard in _layout.tsx will redirect to tabs
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Login failed. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [usernameOrEmail, password, canSubmit, isLoading, login]);

  return (
    <LinearGradient colors={['#0A0A0F', '#121225', '#0A0A0F']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Animated.View entering={FadeInDown.springify().delay(100)} style={styles.logoSection}>
            <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.logoIcon}>
              <Ionicons name="camera" size={32} color={Colors.white} />
            </LinearGradient>
            <Text style={styles.logoText}>INSTAYT</Text>
            <Text style={styles.tagline}>Connect · Create · Inspire</Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View entering={FadeInUp.springify().delay(200)} style={styles.card}>
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Username or Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username or Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color={Colors.dark.textTertiary} style={styles.inputIcon} />
                <TextInput
                  value={usernameOrEmail}
                  onChangeText={setUsernameOrEmail}
                  placeholder="Enter username or email"
                  placeholderTextColor={Colors.dark.textTertiary}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.dark.textTertiary} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={Colors.dark.textTertiary}
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={12}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.dark.textTertiary}
                  />
                </Pressable>
              </View>
            </View>

            {/* Login button */}
            <GradientButton
              title="Log In"
              onPress={handleLogin}
              loading={isLoading}
              disabled={!canSubmit}
              style={styles.loginButton}
            />

            {/* Forgot password */}
            <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </Pressable>
          </Animated.View>

          {/* Sign up link */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.signupRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <Pressable onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl },
  logoSection: { alignItems: 'center', marginBottom: Spacing.xxxl },
  logoIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.base, ...Shadows.glow(Colors.primary) },
  logoText: { fontFamily: Typography.fontFamily.extraBold, fontSize: 36, color: Colors.white, letterSpacing: 4 },
  tagline: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, color: Colors.dark.textSecondary, marginTop: Spacing.xs },
  card: { backgroundColor: Colors.dark.surface, borderRadius: Radii.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.dark.borderLight, ...Shadows.md },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(225,112,85,0.12)', borderRadius: Radii.md, padding: Spacing.md, marginBottom: Spacing.base, gap: Spacing.sm },
  errorText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: Colors.error, flex: 1 },
  inputGroup: { marginBottom: Spacing.lg },
  label: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: Colors.dark.textSecondary, marginBottom: Spacing.sm },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surfaceElevated, borderRadius: Radii.md, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.dark.border },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, color: Colors.white, paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm },
  loginButton: { marginTop: Spacing.sm, marginBottom: Spacing.base },
  forgotText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: Colors.primary, textAlign: 'center' },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xxl },
  signupText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, color: Colors.dark.textSecondary },
  signupLink: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base, color: Colors.primary },
});
