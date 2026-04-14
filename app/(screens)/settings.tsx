import React, { useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/stores/authStore';

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}

function SettingRow({ icon, iconColor, label, onPress, trailing }: SettingRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.settingRow, { borderBottomColor: colors.border }]} onPress={onPress}>
      <Ionicons name={icon} size={22} color={iconColor || colors.textSecondary} style={styles.settingIcon} />
      <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      {trailing || <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = useCallback(() => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }, [logout]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const authApi = await import('../../src/api/auth.api');
              await authApi.deactivateAccount();
              await logout();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to delete account.');
            }
          },
        },
      ],
    );
  }, [logout]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Account */}
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Account</Text>
        <SettingRow icon="person-outline" label="Edit Profile" onPress={() => router.push('/(screens)/edit-profile')} />
        <SettingRow icon="lock-closed-outline" label="Change Password" onPress={() => router.push('/(screens)/change-password' as any)} />
        <SettingRow icon="people-outline" label="Follow Requests" onPress={() => router.push('/(screens)/follow-requests' as any)} />
        <SettingRow icon="bookmark-outline" label="Saved" onPress={() => router.push('/(screens)/saved' as any)} />
        <SettingRow icon="shield-checkmark-outline" label="Privacy" />

        {/* Creator */}
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Creator</Text>
        <SettingRow icon="analytics-outline" iconColor={Colors.accent} label="Insights" onPress={() => router.push('/(screens)/insights' as any)} />
        <SettingRow icon="people-circle-outline" iconColor="#0984E3" label="Collaborations" onPress={() => router.push('/(screens)/collaborations' as any)} />
        <SettingRow icon="wallet-outline" iconColor="#00B894" label="Revenue" onPress={() => router.push('/(screens)/revenue' as any)} />
        <SettingRow icon="megaphone-outline" iconColor="#E17055" label="Promotions" onPress={() => router.push('/(screens)/promotions' as any)} />

        {/* Preferences */}
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Preferences</Text>
        <SettingRow
          icon={isDark ? 'moon' : 'sunny'}
          iconColor={isDark ? Colors.amber : Colors.warning}
          label="Dark Mode"
          trailing={
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ true: Colors.primary, false: colors.border }}
              thumbColor={Colors.white}
            />
          }
        />
        <SettingRow icon="notifications-outline" label="Notifications" />
        <SettingRow icon="language-outline" label="Language" />

        {/* About */}
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>About</Text>
        <SettingRow icon="information-circle-outline" label="About INSTAYT" />
        <SettingRow icon="document-text-outline" label="Terms of Service" />
        <SettingRow icon="shield-outline" label="Privacy Policy" />

        {/* Actions */}
        <View style={styles.dangerSection}>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={Colors.error} />
            <Text style={[styles.logoutText, { color: Colors.error }]}>Log Out</Text>
          </Pressable>
          <Pressable style={styles.deleteBtn} onPress={handleDeleteAccount}>
            <Text style={[styles.deleteText, { color: Colors.error }]}>Delete Account</Text>
          </Pressable>
        </View>

        <Text style={[styles.versionText, { color: colors.textTertiary }]}>INSTAYT v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  content: { paddingBottom: 40 },
  sectionTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.xs, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: Spacing.base, paddingTop: Spacing.xl, paddingBottom: Spacing.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 0.5 },
  settingIcon: { marginRight: Spacing.md },
  settingLabel: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
  dangerSection: { paddingHorizontal: Spacing.base, paddingTop: Spacing.xxl, gap: Spacing.md },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoutText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  deleteBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  deleteText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, opacity: 0.7 },
  versionText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, textAlign: 'center', marginTop: Spacing.xxl },
});
