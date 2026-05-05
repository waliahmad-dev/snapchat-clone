import React, { useState } from 'react';
import { TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProfile } from '@features/profile/hooks/useProfile';
import { EditFieldScreen, useStyledInput } from '@features/settings/components/EditFieldScreen';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function EditNameScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useThemeColors();
  const { profile, updateProfile } = useProfile();
  const s = useStyledInput();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 50;
  const dirty = trimmed !== profile?.display_name;

  async function save() {
    if (!valid || !dirty) return;
    setSaving(true);
    try {
      await updateProfile({ display_name: trimmed });
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
      title={t('settings.account.name.title')}
      description={t('settings.account.name.description')}
      onSave={save}
      saveDisabled={!valid || !dirty}
      saving={saving}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('settings.account.name.placeholder')}
        placeholderTextColor={c.placeholder}
        maxLength={50}
        autoFocus
        style={s.input}
      />
    </EditFieldScreen>
  );
}
