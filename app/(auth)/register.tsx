import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { Colors, Typography, Spacing, Radii, Shadows } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/stores/authStore';
import GradientButton from '../../src/components/GradientButton';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const register = useAuthStore((s) => s.register);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit =
    fullName.trim().length >= 1 &&
    username.trim().length >= 3 &&
    email.includes('@') &&
    password.length >= 6;

  const handleRegister = useCallback(async () => {
    if (!canSubmit || isLoading) return;
    setError('');
    setIsLoading(true);

    try {
      await register({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
      });
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [fullName, username, email, password, canSubmit, isLoading, register]);

  return (
    <LinearGradient colors={['#0A0A0F', '#121225', '#0A0A0F']} style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.springify()} style={styles.headerSection}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </Pressable>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the INSTAYT community</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.springify().delay(100)} style={styles.card}>
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <FormField label="Full Name" icon="person-outline" value={fullName} onChange={setFullName} placeholder="Your full name" returnKeyType="next" onSubmit={() => usernameRef.current?.focus()} />
            <FormField ref={usernameRef} label="Username" icon="at" value={username} onChange={setUsername} placeholder="Choose a username" autoCapitalize="none" returnKeyType="next" onSubmit={() => emailRef.current?.focus()} />
            <FormField ref={emailRef} label="Email" icon="mail-outline" value={email} onChange={setEmail} placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none" returnKeyType="next" onSubmit={() => passwordRef.current?.focus()} />
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.dark.textTertiary} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min 6 characters"
                  placeholderTextColor={Colors.dark.textTertiary}
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.dark.textTertiary} />
                </Pressable>
              </View>
            </View>

            <GradientButton title="Create Account" onPress={handleRegister} loading={isLoading} disabled={!canSubmit} style={styles.submitBtn} />
          </Animated.View>

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.loginLink}>Log In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const FormField = React.forwardRef<TextInput, any>(({ label, icon, value, onChange, placeholder, ...rest }, ref) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputWrapper}>
      <Ionicons name={icon} size={18} color={Colors.dark.textTertiary} style={styles.inputIcon} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.dark.textTertiary}
        style={styles.input}
        onSubmitEditing={rest.onSubmit}
        returnKeyType={rest.returnKeyType}
        keyboardType={rest.keyboardType}
        autoCapitalize={rest.autoCapitalize}
      />
    </View>
  </View>
));

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl },
  headerSection: { marginBottom: Spacing.xxl },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  title: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.xxl, color: Colors.white, marginBottom: Spacing.xs },
  subtitle: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, color: Colors.dark.textSecondary },
  card: { backgroundColor: Colors.dark.surface, borderRadius: Radii.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.dark.borderLight, ...Shadows.md },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(225,112,85,0.12)', borderRadius: Radii.md, padding: Spacing.md, marginBottom: Spacing.base, gap: Spacing.sm },
  errorText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: Colors.error, flex: 1 },
  inputGroup: { marginBottom: Spacing.lg },
  label: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: Colors.dark.textSecondary, marginBottom: Spacing.sm },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surfaceElevated, borderRadius: Radii.md, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.dark.border },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, color: Colors.white, paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm },
  submitBtn: { marginTop: Spacing.sm },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xxl },
  loginText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, color: Colors.dark.textSecondary },
  loginLink: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base, color: Colors.primary },
});
