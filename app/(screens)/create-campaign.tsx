import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii } from '../../src/theme/tokens';
import adApi, {
  type AdObjective, type AdType, type BidType, type ContentSource,
} from '../../src/api/ad.api';

// ─── Step types ───────────────────────────────────────────────────────────────

interface WizardState {
  // Step 1
  objective: AdObjective;
  name: string;
  adType: AdType;
  // Step 2
  contentSource: ContentSource;
  contentId: string;
  budgetTotal: string;
  dailyLimit: string;
  bidType: BidType;
  bidAmount: string;
  startDate: string;
  endDate: string;
  // Step 3
  mediaUrl: string;
  caption: string;
  ctaText: string;
  ctaUrl: string;
}

const INITIAL: WizardState = {
  objective: 'engagement',
  name: '',
  adType: 'sponsored_post',
  contentSource: 'existing_post',
  contentId: '',
  budgetTotal: '',
  dailyLimit: '',
  bidType: 'cpm',
  bidAmount: '0.5',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  mediaUrl: '',
  caption: '',
  ctaText: 'Learn More',
  ctaUrl: '',
};

// ─── Config ───────────────────────────────────────────────────────────────────

const OBJECTIVES: { key: AdObjective; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'awareness', label: 'Awareness', desc: 'Reach more people', icon: 'eye-outline' },
  { key: 'engagement', label: 'Engagement', desc: 'More likes & comments', icon: 'heart-outline' },
  { key: 'conversions', label: 'Conversions', desc: 'Drive actions', icon: 'trending-up-outline' },
];

const AD_TYPES: { key: AdType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'sponsored_post', label: 'Post', icon: 'image-outline' },
  { key: 'sponsored_reel', label: 'Reel', icon: 'videocam-outline' },
  { key: 'banner', label: 'Banner', icon: 'albums-outline' },
  { key: 'native', label: 'Native', icon: 'layers-outline' },
];

const BID_TYPES: { key: BidType; label: string; desc: string }[] = [
  { key: 'cpm', label: 'CPM', desc: 'Pay per 1,000 impressions' },
  { key: 'cpc', label: 'CPC', desc: 'Pay per click' },
];

const CONTENT_SOURCES: { key: ContentSource; label: string }[] = [
  { key: 'existing_post', label: 'Existing Post' },
  { key: 'existing_reel', label: 'Existing Reel' },
  { key: 'uploaded_media', label: 'Upload Media' },
];

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CreateCampaignScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardState>(INITIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const canProceed = useCallback((): boolean => {
    if (step === 1) return form.name.trim().length > 0;
    if (step === 2) {
      const budget = parseFloat(form.budgetTotal);
      const bid = parseFloat(form.bidAmount);
      return budget > 0 && bid > 0 && form.startDate.length > 0 && form.endDate.length > 0;
    }
    return true;
  }, [step, form]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // Step 1: create campaign
      const campaign = await adApi.createCampaign({
        name: form.name.trim(),
        objective: form.objective,
        type: form.adType,
        budget: {
          total: parseFloat(form.budgetTotal),
          daily_limit: form.dailyLimit ? parseFloat(form.dailyLimit) : undefined,
          bid_type: form.bidType,
          bid_amount: parseFloat(form.bidAmount),
        },
        schedule: {
          start_date: new Date(form.startDate).toISOString(),
          end_date: new Date(form.endDate).toISOString(),
        },
      });

      // Step 2: create ad set
      const adSet = await adApi.createAdSet(campaign.id, {
        name: `${form.name.trim()} – Ad Set`,
        budget: {
          bid_type: form.bidType,
          bid_amount: parseFloat(form.bidAmount),
        },
        schedule: {
          start_date: new Date(form.startDate).toISOString(),
          end_date: new Date(form.endDate).toISOString(),
        },
      });

      // Step 3: create creative
      await adApi.createCreative(adSet.id, {
        content_source: form.contentSource,
        content_id: form.contentSource !== 'uploaded_media' ? form.contentId || undefined : undefined,
        media_url: form.mediaUrl || undefined,
        caption: form.caption || undefined,
        cta_text: form.ctaText || undefined,
        cta_url: form.ctaUrl || undefined,
      });

      // Step 4: submit for review
      await adApi.submitForReview(campaign.id);

      Alert.alert('Campaign submitted!', 'Your campaign is under review and will go live shortly.', [
        { text: 'OK', onPress: () => router.replace('/(screens)/promotions') },
      ]);
    } catch (err: any) {
      Alert.alert('Submission failed', err?.response?.data?.message ?? 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, router]);

  const STEP_TITLES = ['Set Objective', 'Budget & Audience', 'Creative Preview'];

  const proceed = canProceed();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => (step > 1 ? setStep(step - 1) : router.back())} hitSlop={8}>
          <Ionicons name={step > 1 ? 'chevron-back' : 'close'} size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{STEP_TITLES[step - 1]}</Text>
          <Text style={[styles.headerStep, { color: colors.textTertiary }]}>Step {step} of 3</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress */}
      <View style={[styles.progressRow, { backgroundColor: colors.border }]}>
        <LinearGradient
          colors={[...Colors.gradientPrimary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]}
        />
      </View>

      {/* Scrollable form — KAV wraps only this so footer stays pinned */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && <Step1 form={form} set={set} colors={colors} />}
          {step === 2 && <Step2 form={form} set={set} colors={colors} />}
          {step === 3 && <Step3 form={form} set={set} colors={colors} />}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer — pinned at bottom, outside KAV so keyboard never hides it */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable
          onPress={() => (step < 3 ? setStep(step + 1) : handleSubmit())}
          disabled={!proceed || isSubmitting}
          style={[styles.nextPressable, { opacity: proceed && !isSubmitting ? 1 : 0.45 }]}
        >
          <LinearGradient
            colors={[...Colors.gradientPrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextBtn}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>{step < 3 ? 'Continue' : 'Submit for Review'}</Text>
                <Ionicons name={step < 3 ? 'arrow-forward' : 'checkmark'} size={18} color="#fff" />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({ form, set, colors }: { form: WizardState; set: any; colors: any }) {
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Campaign Name</Text>
      <TextInput
        style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        placeholder="e.g. Summer Launch"
        placeholderTextColor={colors.textTertiary}
        value={form.name}
        onChangeText={(v) => set('name', v)}
        maxLength={60}
      />

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Objective</Text>
      {OBJECTIVES.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => set('objective', o.key)}
          style={[
            styles.optionCard,
            {
              backgroundColor: form.objective === o.key ? Colors.primary + '20' : colors.surfaceElevated,
              borderColor: form.objective === o.key ? Colors.primary : colors.border,
            },
          ]}
        >
          <View style={[styles.optionIcon, { backgroundColor: Colors.primary + '20' }]}>
            <Ionicons name={o.icon} size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionLabel, { color: colors.text }]}>{o.label}</Text>
            <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>{o.desc}</Text>
          </View>
          {form.objective === o.key && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
        </Pressable>
      ))}

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Ad Format</Text>
      <View style={styles.chipRow}>
        {AD_TYPES.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => set('adType', t.key)}
            style={[
              styles.chip,
              {
                backgroundColor: form.adType === t.key ? Colors.primary : colors.surfaceElevated,
                borderColor: form.adType === t.key ? Colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons name={t.icon} size={16} color={form.adType === t.key ? '#fff' : colors.textSecondary} />
            <Text style={[styles.chipLabel, { color: form.adType === t.key ? '#fff' : colors.textSecondary }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({ form, set, colors }: { form: WizardState; set: any; colors: any }) {
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Content Source</Text>
      <View style={styles.chipRow}>
        {CONTENT_SOURCES.map((cs) => (
          <Pressable
            key={cs.key}
            onPress={() => set('contentSource', cs.key)}
            style={[
              styles.chip,
              {
                backgroundColor: form.contentSource === cs.key ? Colors.primary : colors.surfaceElevated,
                borderColor: form.contentSource === cs.key ? Colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.chipLabel, { color: form.contentSource === cs.key ? '#fff' : colors.textSecondary }]}>
              {cs.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {form.contentSource !== 'uploaded_media' && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Content ID</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            placeholder="Paste post or reel ID"
            placeholderTextColor={colors.textTertiary}
            value={form.contentId}
            onChangeText={(v) => set('contentId', v)}
            autoCapitalize="none"
          />
        </>
      )}

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Bid Strategy</Text>
      {BID_TYPES.map((bt) => (
        <Pressable
          key={bt.key}
          onPress={() => set('bidType', bt.key)}
          style={[
            styles.optionCard,
            {
              backgroundColor: form.bidType === bt.key ? Colors.primary + '20' : colors.surfaceElevated,
              borderColor: form.bidType === bt.key ? Colors.primary : colors.border,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionLabel, { color: colors.text }]}>{bt.label}</Text>
            <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>{bt.desc}</Text>
          </View>
          {form.bidType === bt.key && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
        </Pressable>
      ))}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Bid Amount ($)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            placeholder="0.50"
            placeholderTextColor={colors.textTertiary}
            value={form.bidAmount}
            onChangeText={(v) => set('bidAmount', v)}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Total Budget ($)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            placeholder="50.00"
            placeholderTextColor={colors.textTertiary}
            value={form.budgetTotal}
            onChangeText={(v) => set('budgetTotal', v)}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Start Date</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            value={form.startDate}
            onChangeText={(v) => set('startDate', v)}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>End Date</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            value={form.endDate}
            onChangeText={(v) => set('endDate', v)}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

function Step3({ form, set, colors }: { form: WizardState; set: any; colors: any }) {
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      {/* Mock ad preview card */}
      <View style={[styles.previewCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <View style={styles.previewHeader}>
          <View style={[styles.previewAvatar, { backgroundColor: Colors.primary + '30' }]}>
            <Ionicons name="person" size={18} color={Colors.primary} />
          </View>
          <View>
            <Text style={[styles.previewName, { color: colors.text }]}>Your Account</Text>
            <Text style={[styles.previewSponsored, { color: colors.textTertiary }]}>Sponsored</Text>
          </View>
        </View>
        <View style={[styles.previewMediaPlaceholder, { backgroundColor: colors.border }]}>
          <Ionicons name={form.adType === 'sponsored_reel' ? 'videocam' : 'image'} size={40} color={colors.textTertiary} />
          <Text style={[styles.previewMediaLabel, { color: colors.textTertiary }]}>
            {form.adType === 'sponsored_reel' ? 'Reel Preview' : 'Image Preview'}
          </Text>
        </View>
        {form.caption ? (
          <Text style={[styles.previewCaption, { color: colors.text }]} numberOfLines={2}>{form.caption}</Text>
        ) : null}
        <View style={[styles.previewCTA, { backgroundColor: Colors.primary }]}>
          <Text style={styles.previewCTAText}>{form.ctaText || 'Learn More'}</Text>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Caption</Text>
      <TextInput
        style={[styles.input, styles.textArea, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        placeholder="Write a caption for your ad…"
        placeholderTextColor={colors.textTertiary}
        value={form.caption}
        onChangeText={(v) => set('caption', v)}
        multiline
        numberOfLines={3}
        maxLength={300}
      />

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CTA Text</Text>
      <TextInput
        style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        placeholder="Learn More"
        placeholderTextColor={colors.textTertiary}
        value={form.ctaText}
        onChangeText={(v) => set('ctaText', v)}
        maxLength={30}
      />

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CTA URL (optional)</Text>
      <TextInput
        style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        placeholder="https://example.com"
        placeholderTextColor={colors.textTertiary}
        value={form.ctaUrl}
        onChangeText={(v) => set('ctaUrl', v)}
        autoCapitalize="none"
        keyboardType="url"
      />
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5,
  },
  headerCenter: { alignItems: 'center', gap: 2 },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.size.md },
  headerStep: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  progressRow: { height: 3, width: '100%' },
  progressFill: { height: '100%' },
  scroll: { flex: 1 },
  content: { padding: Spacing.base },
  sectionLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs, marginBottom: Spacing.xs, marginTop: Spacing.lg, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderRadius: Radii.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginBottom: Spacing.xs },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  optionDesc: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderRadius: Radii.full, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  chipLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.xs },
  row: { flexDirection: 'row', gap: Spacing.sm },
  footer: { padding: Spacing.base, borderTopWidth: 0.5 },
  nextPressable: { alignSelf: 'stretch' },
  nextBtn: { borderRadius: Radii.full, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 52 },
  nextBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md, color: '#fff' },
  previewCard: { borderRadius: Radii.xl, borderWidth: 1, overflow: 'hidden', marginBottom: Spacing.xl },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  previewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  previewName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm },
  previewSponsored: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  previewMediaPlaceholder: { height: 200, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  previewMediaLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs },
  previewCaption: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, padding: Spacing.md, paddingBottom: 0 },
  previewCTA: { margin: Spacing.md, borderRadius: Radii.sm, paddingVertical: Spacing.sm, alignItems: 'center' },
  previewCTAText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm, color: '#fff' },
});
