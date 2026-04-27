import React, { useMemo, useState } from 'react';
import { TextInput, Alert, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { updatePassword, validatePassword } from '@features/auth/utils/accountActions';
import { EditFieldScreen, useStyledInput } from '@features/settings/components/EditFieldScreen';
import { useThemeColors } from '@lib/theme/useThemeColors';

const REQUIREMENTS: { label: string; test: (pw: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /[0-9]/.test(p) },
  { label: 'One symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export default function EditPasswordScreen() {
  const router = useRouter();
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
      Alert.alert('Password changed', 'Your password has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        'Could not change password',
        err instanceof Error ? err.message : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditFieldScreen title="Password" onSave={save} saveDisabled={!canSave} saving={saving}>
      <Text style={s.label}>Current password</Text>
      <TextInput
        value={current}
        onChangeText={setCurrent}
        placeholder="••••••••"
        placeholderTextColor="#888"
        secureTextEntry
        autoFocus
        style={s.input}
      />

      <Text style={s.label}>New password</Text>
      <TextInput
        value={next}
        onChangeText={setNext}
        placeholder="••••••••"
        placeholderTextColor="#888"
        secureTextEntry
        style={s.input}
      />

      <View style={{ marginTop: 10, gap: 4 }}>
        {REQUIREMENTS.map((r) => {
          const ok = r.test(next);
          return (
            <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={ok ? '#22C55E' : c.textMuted}
              />
              <Text style={{ color: ok ? c.textPrimary : c.textSecondary, fontSize: 13 }}>
                {r.label}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={s.label}>Confirm new password</Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder="••••••••"
        placeholderTextColor="#888"
        secureTextEntry
        style={s.input}
      />
      {confirm.length > 0 && !matches && <Text style={s.error}>Passwords don't match.</Text>}
    </EditFieldScreen>
  );
}
