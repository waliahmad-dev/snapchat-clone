import React, { useState } from 'react';
import { TextInput, Alert, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/store/authStore';
import { deleteAccount } from '@features/auth/utils/accountActions';
import { EditFieldScreen, useStyledInput } from '@features/settings/components/EditFieldScreen';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const username = useAuthStore((s) => s.profile?.username ?? '');
  const s = useStyledInput();
  const c = useThemeColors();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const confirmPhrase = t('settings.account.delete.confirmPhrase');
  const canSave =
    password.length > 0 && confirm.trim().toUpperCase() === confirmPhrase.toUpperCase();

  async function onSave() {
    if (!canSave) return;
    Alert.alert(
      t('settings.account.delete.alertTitle'),
      t('settings.account.delete.alertBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.account.delete.deleteForever'),
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await deleteAccount(password);
              router.replace('/');
            } catch (err) {
              Alert.alert(
                t('settings.account.delete.errorTitle'),
                err instanceof Error ? err.message : t('settings.account.common.tryAgain'),
              );
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  return (
    <EditFieldScreen
      title={t('settings.account.delete.title')}
      description={t('settings.account.delete.description', {
        username: username || t('settings.account.delete.descriptionFallback'),
      })}
      onSave={onSave}
      saveLabel={t('settings.account.delete.saveLabel')}
      saveDanger
      saveDisabled={!canSave}
      saving={saving}>
      <View
        style={{
          backgroundColor: c.danger + '14',
          borderRadius: 12,
          padding: 14,
          marginBottom: 6,
        }}>
        <Text style={{ color: c.danger, fontWeight: '700', marginBottom: 4 }}>
          {t('settings.account.delete.willLose')}
        </Text>
        <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 19 }}>
          {t('settings.account.delete.lossList')}
        </Text>
      </View>

      <Text style={s.label}>{t('settings.account.delete.passwordLabel')}</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={t('settings.account.delete.passwordPlaceholder')}
        placeholderTextColor={c.placeholder}
        secureTextEntry
        style={s.input}
      />

      <Text style={s.label}>
        {t('settings.account.delete.confirmLabel', { phrase: confirmPhrase })}
      </Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder={confirmPhrase}
        placeholderTextColor={c.placeholder}
        autoCapitalize="characters"
        autoCorrect={false}
        style={s.input}
      />
    </EditFieldScreen>
  );
}
