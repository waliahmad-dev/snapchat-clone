import React, { useMemo, useState } from 'react';
import { TextInput, Alert, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { updatePassword, validatePassword } from '@features/auth/utils/accountActions';
import { EditFieldScreen, useStyledInput } from '@features/settings/components/EditFieldScreen';
import { useThemeColors } from '@lib/theme/useThemeColors';

const REQUIREMENTS: { key: string; test: (pw: string) => boolean }[] = [
  { key: 'settings.account.password.req8chars', test: (p) => p.length >= 8 },
  { key: 'settings.account.password.reqUpper', test: (p) => /[A-Z]/.test(p) },
  { key: 'settings.account.password.reqLower', test: (p) => /[a-z]/.test(p) },
  { key: 'settings.account.password.reqNumber', test: (p) => /[0-9]/.test(p) },
  { key: 'settings.account.password.reqSymbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export default function EditPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const s = useStyledInput();
  const c = useThemeColors();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const strength = useMemo(() => validatePassword(next), [next]);
  const matches = next.length > 0 && next === confirm;
  const canSave = current.length > 0 && strength.ok && matches;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await updatePassword(current, next);
      Alert.alert(
        t('settings.account.password.successTitle'),
        t('settings.account.password.successBody'),
        [{ text: t('common.ok'), onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert(
        t('settings.account.password.errorTitle'),
        err instanceof Error ? err.message : t('settings.account.common.tryAgain'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditFieldScreen
      title={t('settings.account.password.title')}
      onSave={save}
      saveDisabled={!canSave}
      saving={saving}>
      <Text style={s.label}>{t('settings.account.password.currentLabel')}</Text>
      <TextInput
        value={current}
        onChangeText={setCurrent}
        placeholder={t('settings.account.password.placeholder')}
        placeholderTextColor={c.placeholder}
        secureTextEntry
        autoFocus
        style={s.input}
      />

      <Text style={s.label}>{t('settings.account.password.newLabel')}</Text>
      <TextInput
        value={next}
        onChangeText={setNext}
        placeholder={t('settings.account.password.placeholder')}
        placeholderTextColor={c.placeholder}
        secureTextEntry
        style={s.input}
      />

      <View style={{ marginTop: 10, gap: 4 }}>
        {REQUIREMENTS.map((r) => {
          const ok = r.test(next);
          return (
            <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={ok ? '#22C55E' : c.textMuted}
              />
              <Text style={{ color: ok ? c.textPrimary : c.textSecondary, fontSize: 13 }}>
                {t(r.key)}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={s.label}>{t('settings.account.password.confirmLabel')}</Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder={t('settings.account.password.placeholder')}
        placeholderTextColor={c.placeholder}
        secureTextEntry
        style={s.input}
      />
      {confirm.length > 0 && !matches && (
        <Text style={s.error}>{t('settings.account.password.mismatch')}</Text>
      )}
    </EditFieldScreen>
  );
}
