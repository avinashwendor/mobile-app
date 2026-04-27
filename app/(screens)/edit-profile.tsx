import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  Alert, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Colors, Typography, Spacing, HitSlop } from '../../src/theme/tokens';
import UserAvatar from '../../src/components/UserAvatar';
import { useAuthStore } from '../../src/stores/authStore';
import * as authApi from '../../src/api/auth.api';
import * as userApi from '../../src/api/user.api';

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [socialLinksText, setSocialLinksText] = useState((user?.socialLinks ?? []).join('\n'));
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const handlePickAvatar = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Avatar is persisted server-side by uploadAvatar — the profile refetch
      // below will pick up the new URL, so we don't pass it to updateProfile.
      if (avatarUri) {
        await userApi.uploadAvatar(avatarUri);
      }

      const updated = await authApi.updateProfile({
        fullName: fullName.trim(),
        bio: bio.trim(),
        website: website.trim(),
        socialLinks: socialLinksText.split('\n').map((link) => link.trim()).filter(Boolean),
        isPrivate,
      });

      setUser(updated as any);
      Alert.alert('Success', 'Profile updated!');
      router.back();
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.message || 'Failed to update profile.';
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  }, [avatarUri, bio, fullName, isPrivate, router, setUser, socialLinksText, website]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={HitSlop.md}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
        <Pressable onPress={handleSave} disabled={isSaving}>
          <Text style={[styles.saveBtn, { color: Colors.primary, opacity: isSaving ? 0.5 : 1 }]}>
            {isSaving ? 'Saving...' : 'Done'}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <Pressable onPress={handlePickAvatar} style={styles.avatarSection}>
          <UserAvatar uri={avatarUri || user?.profilePicture} size="xxl" />
          <Text style={[styles.changePhotoText, { color: Colors.primary }]}>Change Photo</Text>
        </Pressable>

        {/* Fields */}
        <View style={styles.fields}>
          <EditField label="Name" value={fullName} onChange={setFullName} placeholder="Full name" />
          <EditField label="Bio" value={bio} onChange={setBio} placeholder="Tell about yourself..." multiline maxLength={150} />
          <EditField label="Website" value={website} onChange={setWebsite} placeholder="www.example.com" keyboardType="url" />
          <EditField
            label="Other links"
            value={socialLinksText}
            onChange={setSocialLinksText}
            placeholder="instagram.com/yourname&#10;youtube.com/@yourchannel"
            keyboardType="url"
            multiline
            maxLength={500}
          />
          <Text style={[styles.helperText, { color: colors.textTertiary }]}>Add one social or website link per line.</Text>

          <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Private Account</Text>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ true: Colors.primary, false: colors.border }}
              thumbColor={Colors.white}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function EditField({ label, value, onChange, placeholder, multiline, maxLength, keyboardType }: any) {
  const { colors } = useTheme();
  return (
    <View style={[fieldStyles.container, { borderBottomColor: colors.border }]}>
      <Text style={[fieldStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[fieldStyles.input, { color: colors.text }]}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { paddingVertical: Spacing.md, borderBottomWidth: 0.5 },
  label: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.sm, marginBottom: Spacing.xs },
  input: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.md },
  saveBtn: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.base },
  content: { paddingHorizontal: Spacing.base },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  changePhotoText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.size.sm, marginTop: Spacing.md },
  fields: { gap: 0 },
  helperText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.xs, marginTop: Spacing.sm },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 0.5 },
  fieldLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.size.base },
});
