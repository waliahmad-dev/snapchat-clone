import React, { useState } from 'react';
import { TextInput, Alert, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/store/authStore';
import { updateEmail } from '@features/auth/utils/accountActions';
import { EditFieldScreen, useStyledInput } from '@features/settings/components/EditFieldScreen';
import { useThemeColors } from '@lib/theme/useThemeColors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EditEmailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const currentEmail = useAuthStore((s) => s.user?.email ?? '');
  const s = useStyledInput();
  const c = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const trimmedEmail = email.trim().toLowerCase();
  const emailOk = EMAIL_REGEX.test(trimmedEmail);
  const dirty = trimmedEmail !== currentEmail;
  const canSave = emailOk && dirty && password.length > 0;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await updateEmail(password, trimmedEmail);
      Alert.alert(
        t('settings.account.email.confirmTitle'),
        t('settings.account.email.confirmBody'),
        [{ text: t('common.ok'), onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert(
        t('settings.account.email.errorTitle'),
        err instanceof Error ? err.message : t('settings.account.common.tryAgain')
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditFieldScreen
      title={t('settings.account.email.title')}
      description={t('settings.account.email.description')}
      onSave={save}
      saveDisabled={!canSave}
      saving={saving}>
      <Text style={s.label}>{t('settings.account.email.newEmailLabel')}</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={t('settings.account.email.emailPlaceholder')}
        placeholderTextColor={c.placeholder}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        style={s.input}
      />
      {!emailOk && email.length > 0 && (
        <Text style={s.error}>{t('settings.account.email.emailInvalid')}</Text>
      )}

      <Text style={s.label}>{t('settings.account.email.passwordLabel')}</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={t('settings.account.email.passwordPlaceholder')}
        placeholderTextColor={c.placeholder}
        secureTextEntry
        style={s.input}
      />
    </EditFieldScreen>
  );
}
