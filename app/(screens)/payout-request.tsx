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
import revenueApi, { type PayoutMethod, type RevenueSummary } from '../../src/api/revenue.api';

const MIN_PAYOUT = 10;

const METHODS: { key: PayoutMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'bank_transfer', label: 'Bank Transfer', icon: 'business-outline' },
  { key: 'paypal', label: 'PayPal', icon: 'logo-paypal' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet-outline' },
];

export default function PayoutRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [method, setMethod] = useState<PayoutMethod>('bank_transfer');
  const [amount, setAmount] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankRouting, setBankRouting] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    revenueApi.getSummary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const available = summary?.available ?? 0;

  const validate = useCallback((): string | null => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < MIN_PAYOUT) return `Minimum payout is $${MIN_PAYOUT}`;
    if (amt > available) return `Amount exceeds available balance ($${available.toFixed(2)})`;
    if (method === 'paypal' && !paypalEmail.trim()) return 'Please enter your PayPal email';
    if (method === 'bank_transfer') {
      if (!bankAccount.trim()) return 'Please enter account number';
      if (!bankRouting.trim()) return 'Please enter routing number';
    }
    return null;
  }, [amount, method, paypalEmail, bankAccount, bankRouting, available]);

  const handleSubmit = useCallback(async () => {
    const err = validate();
    if (err) { Alert.alert('Invalid input', err); return; }

    setIsSubmitting(true);
    try {
      await revenueApi.requestPayout({
        amount: parseFloat(amount),
        method,
        paypal_email: method === 'paypal' ? paypalEmail.trim() : undefined,
        bank_details: method === 'bank_transfer' ? {
          account_name: accountName.trim() || undefined,
          account_number: bankAccount.trim(),
          routing_number: bankRouting.trim(),
          bank_name: bankName.trim() || undefined,
        } : undefined,
      });
      Alert.alert('Payout requested!', 'Your request is being processed. You will be notified once it completes.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not submit payout request. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [validate, amount, method, paypalEmail, accountName, bankAccount, bankRouting, bankName, router]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Withdraw Funds</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Balance card */}
          <Animated.View entering={FadeInDown.delay(50)}>
            <LinearGradient colors={['#00B894', '#55EFC4']} style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.balanceValue}>${available.toFixed(2)}</Text>
              )}
              <Text style={styles.balanceSub}>Minimum payout: ${MIN_PAYOUT}</Text>
            </LinearGradient>
          </Animated.View>

          {/* Amount input */}
          <Animated.View entering={FadeInDown.delay(100)}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Amount ($)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              placeholder={`Min $${MIN_PAYOUT}`}
              placeholderTextColor={colors.textTertiary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <Pressable onPress={() => setAmount(available.toFixed(2))}>
              <Text style={[styles.maxLink, { color: Colors.primary }]}>Use max (${available.toFixed(2)})</Text>
            </Pressable>
          </Animated.View>

          {/* Method selector */}
          <Animated.View entering={FadeInDown.delay(150)}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Payment Method</Text>
            {METHODS.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => setMethod(m.key)}
                style={[
                  styles.methodCard,
                  {
                    backgroundColor: method === m.key ? Colors.primary + '20' : colors.surfaceElevated,
                    borderColor: method === m.key ? Colors.primary : colors.border,
                  },
                ]}
              >
                <View style={[styles.methodIcon, { backgroundColor: Colors.primary + '20' }]}>
                  <Ionicons name={m.icon} size={20} color={Colors.primary} />
                </View>
                <Text style={[styles.methodLabel, { color: colors.text }]}>{m.label}</Text>
                {method === m.key && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </Pressable>
            ))}
          </Animated.View>

          {/* Conditional details */}
          {method === 'paypal' && (
            <Animated.View entering={FadeInDown.delay(200)}>
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

          {method === 'bank_transfer' && (
            <Animated.View entering={FadeInDown.delay(200)}>
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
                value={bankAccount}
                onChangeText={setBankAccount}
                keyboardType="number-pad"
              />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Routing Number</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                placeholder="021000021"
                placeholderTextColor={colors.textTertiary}
                value={bankRouting}
                onChangeText={setBankRouting}
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

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, borderTopColor: colors.border }]}>
          <Pressable onPress={handleSubmit} disabled={isSubmitting} style={{ flex: 1 }}>
            <LinearGradient colors={[...Colors.gradientPrimary]} style={styles.submitBtn}>
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cash-outline" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Request Payout</Text>
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5,
  },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.lg },
  scroll: { flex: 1 },
  content: { padding: Spacing.base },
  balanceCard: { borderRadius: Radii.xl, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.xl },
  balanceLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.8)', marginBottom: Spacing.xs },
  balanceValue: { fontFamily: Typography.fontFamily.bold, fontSize: 40, color: '#fff' },
  balanceSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.7)', marginTop: Spacing.xs },
  label: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs, marginBottom: Spacing.xs, marginTop: Spacing.lg, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderRadius: Radii.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginBottom: Spacing.xs },
  maxLink: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs, marginTop: 4, marginBottom: Spacing.sm },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  methodIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { flex: 1, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  footer: { padding: Spacing.base, borderTopWidth: 0.5 },
  submitBtn: { borderRadius: Radii.full, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  submitBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md, color: '#fff' },
});
