import React, { useEffect, useState } from 'react';
import { TextInput, Alert, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      Alert.alert(
        t('settings.account.common.couldNotSave'),
        err instanceof Error ? err.message : t('settings.account.common.tryAgain'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditFieldScreen
      title={t('settings.account.username.title')}
      onSave={save}
      saveDisabled={!canSave}
      saving={saving}>
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder={t('settings.account.username.placeholder')}
        placeholderTextColor={c.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        autoFocus
        style={s.input}
      />

      <View style={{ marginTop: 12 }}>
        {!formatOk && username.length > 0 && (
          <Text style={s.error}>{t('settings.account.username.errorFormat')}</Text>
        )}
        <Text style={s.hint}>
          {remaining === null
            ? t('settings.account.username.hintInitial', { count: USERNAME_CHANGES_PER_YEAR })
            : remaining > 0
              ? t('settings.account.username.hintRemaining', {
                  remaining,
                  count: USERNAME_CHANGES_PER_YEAR,
                })
              : t('settings.account.username.hintExhausted')}
        </Text>
        <Text style={[s.hint, { marginTop: 4, color: c.textMuted }]}>
          {t('settings.account.username.hintReuse')}
        </Text>
      </View>
    </EditFieldScreen>
  );
}
