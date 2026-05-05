import React, { useState } from 'react';
import { TextInput, Alert, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProfile } from '@features/profile/hooks/useProfile';
import { PHONE_REGEX, updatePhone } from '@features/auth/utils/accountActions';
import { useAuthStore } from '@features/auth/store/authStore';
import { EditFieldScreen, useStyledInput } from '@features/settings/components/EditFieldScreen';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function EditPhoneScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, refresh } = useProfile();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const s = useStyledInput();
  const c = useThemeColors();
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const compact = phone.replace(/\s+/g, '');
  const formatOk = compact === '' || PHONE_REGEX.test(compact);
  const dirty = compact !== (profile?.phone ?? '');
  const canSave = formatOk && dirty;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await updatePhone(userId, compact === '' ? null : compact);
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
      title={t('settings.account.phone.title')}
      description={t('settings.account.phone.description')}
      onSave={save}
      saveDisabled={!canSave}
      saving={saving}>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder={t('settings.account.phone.placeholder')}
        placeholderTextColor={c.placeholder}
        keyboardType="phone-pad"
        maxLength={16}
        autoFocus
        style={s.input}
      />
      {!formatOk && phone.length > 0 && (
        <Text style={s.error}>{t('settings.account.phone.errorFormat')}</Text>
      )}
    </EditFieldScreen>
  );
}
