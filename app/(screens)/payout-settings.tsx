import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import revenueApi, { type PayoutMethod, type PayoutSettings } from '../../src/api/revenue.api';

const METHODS: { key: PayoutMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'bank_transfer', label: 'Bank Transfer', icon: 'business-outline' },
  { key: 'paypal', label: 'PayPal', icon: 'logo-paypal' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet-outline' },
];

export default function PayoutSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [preferredMethod, setPreferredMethod] = useState<PayoutMethod>('bank_transfer');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [bankName, setBankName] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const s: PayoutSettings = await revenueApi.getPayoutSettings();
      setPreferredMethod(s.preferred_method ?? 'bank_transfer');
      setPaypalEmail(s.paypal_email ?? '');
      setAccountName(s.bank_details?.account_name ?? '');
      setAccountNumber(s.bank_details?.account_number ?? '');
      setRoutingNumber(s.bank_details?.routing_number ?? '');
      setBankName(s.bank_details?.bank_name ?? '');
    } catch {
      // If no settings exist yet that's fine — user will create them on save
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await revenueApi.updatePayoutSettings({
        preferred_method: preferredMethod,
        paypal_email: preferredMethod === 'paypal' ? paypalEmail.trim() || null : null,
        bank_details: preferredMethod === 'bank_transfer' ? {
          account_name: accountName.trim() || undefined,
          account_number: accountNumber.trim() || undefined,
          routing_number: routingNumber.trim() || undefined,
          bank_name: bankName.trim() || undefined,
        } : null,
      });
      Alert.alert('Saved', 'Payout settings updated.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not save settings. Try again.');
    } finally {
      setIsSaving(false);
    }
  }, [preferredMethod, paypalEmail, accountName, accountNumber, routingNumber, bankName, router]);

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Payout Settings</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Info banner */}
          <Animated.View entering={FadeInDown.delay(50)} style={[styles.infoBanner, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' }]}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Your payout method is used for all withdrawal requests. Keep your details accurate.
            </Text>
          </Animated.View>

          {/* Preferred method */}
          <Animated.View entering={FadeInDown.delay(100)}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Preferred Method</Text>
            {METHODS.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => setPreferredMethod(m.key)}
                style={[
                  styles.methodCard,
                  {
                    backgroundColor: preferredMethod === m.key ? Colors.primary + '20' : colors.surfaceElevated,
                    borderColor: preferredMethod === m.key ? Colors.primary : colors.border,
                  },
                ]}
              >
                <View style={[styles.methodIcon, { backgroundColor: Colors.primary + '20' }]}>
                  <Ionicons name={m.icon} size={20} color={Colors.primary} />
                </View>
                <Text style={[styles.methodLabel, { color: colors.text }]}>{m.label}</Text>
                {preferredMethod === m.key && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </Pressable>
            ))}
          </Animated.View>

          {/* PayPal details */}
          {preferredMethod === 'paypal' && (
            <Animated.View entering={FadeInDown.delay(150)}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>PayPal Email</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textTertiary}
                value={paypalEmail}
                onChangeText={setPaypalEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Animated.View>
          )}

          {/* Bank details */}
          {preferredMethod === 'bank_transfer' && (
            <Animated.View entering={FadeInDown.delay(150)}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Account Name</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                placeholder="Full name on account"
                placeholderTextColor={colors.textTertiary}
                value={accountName}
                onChangeText={setAccountName}
              />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Account Number</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                placeholder="000000000"
                placeholderTextColor={colors.textTertiary}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="number-pad"
              />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Routing Number</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                placeholder="021000021"
                placeholderTextColor={colors.textTertiary}
                value={routingNumber}
                onChangeText={setRoutingNumber}
                keyboardType="number-pad"
              />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Bank Name (optional)</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                placeholder="Chase, Wells Fargo…"
                placeholderTextColor={colors.textTertiary}
                value={bankName}
                onChangeText={setBankName}
              />
            </Animated.View>
          )}
        </ScrollView>

        {/* Save button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, borderTopColor: colors.border }]}>
          <Pressable onPress={handleSave} disabled={isSaving} style={{ flex: 1 }}>
            <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.saveBtn}>
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Settings</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5,
  },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  scroll: { flex: 1 },
  content: { padding: Spacing.base },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderRadius: Radii.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.lg },
  infoText: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, lineHeight: 18 },
  label: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs, marginBottom: Spacing.xs, marginTop: Spacing.lg, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderRadius: Radii.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginBottom: Spacing.xs },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  methodIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { flex: 1, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  footer: { padding: Spacing.base, borderTopWidth: 0.5 },
  saveBtn: { borderRadius: Radii.full, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  saveBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md, color: '#fff' },
});
