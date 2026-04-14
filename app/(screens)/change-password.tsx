import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/stores/authStore';
import * as authApi from '../../src/api/auth.api';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const canSubmit = currentPassword.length >= 6 && newPassword.length >= 6 && newPassword === confirmPassword;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSaving) return;
    setError('');
    setIsSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  }, [currentPassword, newPassword, canSubmit, isSaving]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Change Password</Text>
        <Pressable onPress={handleSubmit} disabled={!canSubmit || isSaving}>
          <Text style={[styles.saveBtn, { color: canSubmit ? Colors.primary : colors.textTertiary }]}>
            {isSaving ? 'Saving...' : 'Done'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.emerald} />
              <Text style={styles.successText}>Password changed successfully!</Text>
            </View>
          ) : null}

          <PasswordField label="Current Password" value={currentPassword} onChange={setCurrentPassword} placeholder="Enter current password" colors={colors} />
          <PasswordField label="New Password" value={newPassword} onChange={setNewPassword} placeholder="Min 6 characters" colors={colors} />
          <PasswordField label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter new password" colors={colors} />

          {newPassword.length > 0 && newPassword !== confirmPassword && confirmPassword.length > 0 && (
            <Text style={styles.mismatchText}>Passwords do not match</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function PasswordField({ label, value, onChange, placeholder, colors }: any) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.fieldWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          style={[styles.fieldInput, { color: colors.text }]}
          secureTextEntry={!show}
        />
        <Pressable onPress={() => setShow(!show)}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  saveBtn: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  content: { padding: Spacing.xl },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(225,112,85,0.12)', borderRadius: Radii.md, padding: Spacing.md, marginBottom: Spacing.lg, gap: Spacing.sm },
  errorText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: Colors.error, flex: 1 },
  successBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,184,148,0.12)', borderRadius: Radii.md, padding: Spacing.md, marginBottom: Spacing.lg, gap: Spacing.sm },
  successText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: Colors.emerald, flex: 1 },
  fieldGroup: { marginBottom: Spacing.lg },
  fieldLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, marginBottom: Spacing.sm },
  fieldWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: Radii.md, paddingHorizontal: Spacing.md, borderWidth: 1 },
  fieldInput: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base, paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm },
  mismatchText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, color: Colors.error },
});
