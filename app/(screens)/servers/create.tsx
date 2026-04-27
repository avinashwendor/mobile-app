import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, Radii, HitSlop } from '../../../src/theme/tokens';
import * as serverApi from '../../../src/api/server.api';

const SUGGESTED_CATEGORIES = [
  'Gaming', 'Music', 'Art', 'Technology', 'Sports',
  'Anime', 'Science', 'Movies', 'Fitness', 'Photography',
  'Travel', 'Food', 'Education', 'Finance', 'Fashion',
];

const MAX_NAME = 100;
const MAX_DESC = 1000;
const MAX_RULES = 2000;
const MAX_CATEGORIES = 5;

export default function CreateServerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat);
      if (prev.length >= MAX_CATEGORIES) {
        Alert.alert('Limit reached', `You can select at most ${MAX_CATEGORIES} categories.`);
        return prev;
      }
      return [...prev, cat];
    });
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter a name for your server.');
      return;
    }
    setIsCreating(true);
    try {
      const server = await serverApi.createServer({
        name: trimmedName,
        description: description.trim(),
        isPublic,
        categories: selectedCategories,
        rules: rules.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate to the new server
      router.replace(`/(screens)/servers/${server._id}` as any);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Could not create server.');
    } finally {
      setIsCreating(false);
    }
  }, [name, description, isPublic, selectedCategories, rules, router]);

  const canCreate = name.trim().length > 0 && !isCreating;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Server</Text>
        <Pressable onPress={handleCreate} disabled={!canCreate} hitSlop={HitSlop.md}>
          {isCreating
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Text style={[styles.createBtn, { color: canCreate ? Colors.primary : colors.textTertiary }]}>Create</Text>}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Icon preview */}
          <Animated.View entering={FadeInDown.delay(60).duration(320).springify()} style={styles.iconSection}>
            <LinearGradient
              colors={[Colors.primary, Colors.coral]}
              style={styles.iconPreview}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.iconLetter}>
                {name.trim() ? name.trim()[0].toUpperCase() : '#'}
              </Text>
            </LinearGradient>
            <Text style={[styles.iconHint, { color: colors.textTertiary }]}>
              Server icon is auto-generated from name
            </Text>
          </Animated.View>

          {/* Name */}
          <Animated.View entering={FadeInDown.delay(100).duration(300).springify()} style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>SERVER NAME *</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? colors.surfaceElevated : colors.surface }]}
              placeholder="e.g. Awesome Community"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              maxLength={MAX_NAME}
              autoCorrect={false}
            />
            <Text style={[styles.charCount, { color: colors.textTertiary }]}>{name.length}/{MAX_NAME}</Text>
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.delay(140).duration(300).springify()} style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>DESCRIPTION</Text>
            <TextInput
              style={[styles.inputMulti, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? colors.surfaceElevated : colors.surface }]}
              placeholder="What's this server about?"
              placeholderTextColor={colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={MAX_DESC}
              numberOfLines={3}
            />
            <Text style={[styles.charCount, { color: colors.textTertiary }]}>{description.length}/{MAX_DESC}</Text>
          </Animated.View>

          {/* Visibility */}
          <Animated.View entering={FadeInDown.delay(180).duration(300).springify()} style={[styles.fieldGroup, { gap: 0 }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>VISIBILITY</Text>
            <View style={[styles.toggleRow, { backgroundColor: isDark ? colors.surfaceElevated : colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>
                  {isPublic ? 'Public' : 'Private'}
                </Text>
                <Text style={[styles.toggleHint, { color: colors.textTertiary }]}>
                  {isPublic
                    ? 'Anyone can find and join this server'
                    : 'Only people with an invite can join'}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: Colors.primary, false: colors.border }}
                thumbColor={Colors.white}
              />
            </View>
          </Animated.View>

          {/* Categories */}
          <Animated.View entering={FadeInDown.delay(220).duration(300).springify()} style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              CATEGORIES ({selectedCategories.length}/{MAX_CATEGORIES})
            </Text>
            <View style={styles.categoryChips}>
              {SUGGESTED_CATEGORIES.map((cat) => {
                const selected = selectedCategories.includes(cat);
                return (
                  <Pressable
                    key={cat}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleCategory(cat); }}
                    style={[
                      styles.chip,
                      selected
                        ? { backgroundColor: Colors.primary, borderColor: Colors.primary }
                        : { backgroundColor: 'transparent', borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: selected ? Colors.white : colors.textSecondary }]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Rules */}
          <Animated.View entering={FadeInDown.delay(260).duration(300).springify()} style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>SERVER RULES</Text>
            <TextInput
              style={[styles.inputMulti, styles.rulesInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? colors.surfaceElevated : colors.surface }]}
              placeholder="Add community guidelines and rules (optional)"
              placeholderTextColor={colors.textTertiary}
              value={rules}
              onChangeText={setRules}
              multiline
              maxLength={MAX_RULES}
              numberOfLines={5}
            />
            <Text style={[styles.charCount, { color: colors.textTertiary }]}>{rules.length}/{MAX_RULES}</Text>
          </Animated.View>

          {/* Create button */}
          <Animated.View entering={FadeInDown.delay(300).duration(300).springify()} style={styles.submitSection}>
            <Pressable onPress={handleCreate} disabled={!canCreate} style={[styles.submitBtn, { opacity: canCreate ? 1 : 0.5 }]}>
              <LinearGradient
                colors={[...Colors.gradientPrimary]}
                style={styles.submitGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isCreating
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.submitText}>Create Server</Text>}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  createBtn: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  scroll: { paddingHorizontal: Spacing.base, paddingTop: Spacing.lg, gap: Spacing.xl },
  iconSection: { alignItems: 'center', gap: Spacing.sm },
  iconPreview: {
    width: 80,
    height: 80,
    borderRadius: Radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLetter: { color: Colors.white, fontFamily: Typography.fontFamily.extraBold, fontSize: 36 },
  iconHint: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, textAlign: 'center' },
  fieldGroup: { gap: Spacing.sm },
  label: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    height: 46,
  },
  inputMulti: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.size.base,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rulesInput: { minHeight: 110 },
  charCount: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, alignSelf: 'flex-end' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  toggleTitle: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.base },
  toggleHint: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: 2 },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  chipText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.size.sm },
  submitSection: { paddingTop: Spacing.sm },
  submitBtn: { borderRadius: Radii.full, overflow: 'hidden' },
  submitGrad: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radii.full,
  },
  submitText: { color: Colors.white, fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
});
