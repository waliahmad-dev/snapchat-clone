import React, { useState } from 'react';
import { TextInput, Alert, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@features/auth/store/authStore';
import { updateEmail } from '@features/auth/utils/accountActions';
import { EditFieldScreen, useStyledInput } from '@features/settings/components/EditFieldScreen';
import { useThemeColors } from '@lib/theme/useThemeColors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EditEmailScreen() {
  const router = useRouter();
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
        'Confirm your email',
        'A confirmation link has been sent to your new email address. Your email will update once you confirm.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert(
        'Could not change email',
        err instanceof Error ? err.message : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditFieldScreen
      title="Email"
      description={`Enter your new email and password to confirm.`}
      onSave={save}
      saveDisabled={!canSave}
      saving={saving}>
      <Text style={s.label}>New email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={c.placeholder}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        style={s.input}
      />
      {!emailOk && email.length > 0 && <Text style={s.error}>Enter a valid email address.</Text>}

      <Text style={s.label}>Current password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        placeholderTextColor={c.placeholder}
        secureTextEntry
        style={s.input}
      />
    </EditFieldScreen>
  );
}
