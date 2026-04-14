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
import GradientButton from '../../src/components/GradientButton';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = email.includes('@') && email.includes('.');

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isLoading) return;
    setIsLoading(true);
    // Simulate — backend may not have this endpoint yet
    setTimeout(() => {
      setIsSent(true);
      setIsLoading(false);
    }, 1500);
  }, [email, canSubmit, isLoading]);

  return (
    <LinearGradient colors={['#0A0A0F', '#121225', '#0A0A0F']} style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Animated.View entering={FadeInDown.springify()}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </Pressable>
          </Animated.View>

          {isSent ? (
            /* Success state */
            <Animated.View entering={FadeInUp.springify()} style={styles.successSection}>
              <View style={styles.successIcon}>
                <LinearGradient colors={[...Colors.gradientAccent]} style={styles.successCircle}>
                  <Ionicons name="mail-open-outline" size={40} color={Colors.white} />
                </LinearGradient>
              </View>
              <Text style={styles.successTitle}>Check Your Email</Text>
              <Text style={styles.successText}>
                We've sent a password reset link to{'\n'}
                <Text style={styles.emailHighlight}>{email}</Text>
              </Text>
              <GradientButton
                title="Back to Login"
                onPress={() => router.replace('/(auth)/login')}
                style={styles.backToLogin}
              />
              <Pressable onPress={() => { setIsSent(false); setEmail(''); }}>
                <Text style={styles.resendText}>Didn't receive it? Try again</Text>
              </Pressable>
            </Animated.View>
          ) : (
            /* Form state */
            <>
              <Animated.View entering={FadeInDown.springify().delay(100)} style={styles.headerSection}>
                <View style={styles.lockIcon}>
                  <Ionicons name="lock-open-outline" size={32} color={Colors.primary} />
                </View>
                <Text style={styles.title}>Forgot Password?</Text>
                <Text style={styles.description}>
                  Enter the email address associated with your account and we'll send you a link to reset your password.
                </Text>
              </Animated.View>

              <Animated.View entering={FadeInUp.springify().delay(200)} style={styles.card}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={18} color={Colors.dark.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Enter your email"
                      placeholderTextColor={Colors.dark.textTertiary}
                      style={styles.input}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                  </View>
                </View>

                <GradientButton
                  title="Send Reset Link"
                  onPress={handleSubmit}
                  loading={isLoading}
                  disabled={!canSubmit}
                />
              </Animated.View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xxl },
  headerSection: { alignItems: 'center', marginBottom: Spacing.xxl },
  lockIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(108,92,231,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  title: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xxl, color: Colors.white, marginBottom: Spacing.md },
  description: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 24, maxWidth: 300 },
  card: { backgroundColor: Colors.dark.surface, borderRadius: Radii.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.dark.borderLight, ...Shadows.md },
  inputGroup: { marginBottom: Spacing.lg },
  label: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: Colors.dark.textSecondary, marginBottom: Spacing.sm },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surfaceElevated, borderRadius: Radii.md, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.dark.border },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, color: Colors.white, paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm },
  successSection: { alignItems: 'center', paddingTop: 40 },
  successIcon: { marginBottom: Spacing.xl },
  successCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', ...Shadows.glow(Colors.accent) },
  successTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xl, color: Colors.white, marginBottom: Spacing.md },
  successText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.xxl },
  emailHighlight: { fontFamily: Typography.fontFamily.semiBold, color: Colors.primary },
  backToLogin: { marginBottom: Spacing.lg, width: '100%' },
  resendText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: Colors.primary },
});
