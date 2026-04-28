import React, { useEffect, useState } from 'react';
import { TextInput, Alert, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useProfile } from '@features/profile/hooks/useProfile';
import {
  USERNAME_REGEX,
  USERNAME_CHANGES_PER_YEAR,
  getUsernameChangesRemaining,
  updateUsername,
} from '@features/auth/utils/accountActions';
import { useAuthStore } from '@features/auth/store/authStore';
import { EditFieldScreen, useStyledInput } from '@features/settings/components/EditFieldScreen';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function EditUsernameScreen() {
  const router = useRouter();
  const { profile, refresh } = useProfile();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const s = useStyledInput();
  const c = useThemeColors();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    getUsernameChangesRemaining(userId)
      .then(setRemaining)
      .catch(() => setRemaining(null));
  }, [userId]);

  const normalized = username.trim().toLowerCase();
  const formatOk = USERNAME_REGEX.test(normalized);
  const dirty = normalized !== profile?.username;
  const noQuotaLeft = remaining !== null && remaining <= 0;
  const canSave = formatOk && dirty && !noQuotaLeft;

  async function save() {
    if (!canSave || !profile) return;
    setSaving(true);
    try {
      await updateUsername(userId, profile.username, normalized);
      await refresh();
      router.back();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditFieldScreen title="Username" onSave={save} saveDisabled={!canSave} saving={saving}>
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Username"
        placeholderTextColor={c.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        autoFocus
        style={s.input}
      />

      <View style={{ marginTop: 12 }}>
        {!formatOk && username.length > 0 && (
          <Text style={s.error}>
            Must be 3–20 characters: lowercase letters, numbers, dot or underscore.
          </Text>
        )}
        <Text style={s.hint}>
          {remaining === null
            ? `You can change your username up to ${USERNAME_CHANGES_PER_YEAR} times per year.`
            : remaining > 0
              ? `${remaining} of ${USERNAME_CHANGES_PER_YEAR} changes remaining this year.`
              : 'You have used all your username changes for this year.'}
        </Text>
        <Text style={[s.hint, { marginTop: 4, color: c.textMuted }]}>
          A username can be reused only after the previous owner releases it.
        </Text>
      </View>
    </EditFieldScreen>
  );
}
