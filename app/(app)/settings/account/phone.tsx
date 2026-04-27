import React, { useState } from 'react';
import { TextInput, Alert, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useProfile } from '@features/profile/hooks/useProfile';
import { PHONE_REGEX, updatePhone } from '@features/auth/utils/accountActions';
import { useAuthStore } from '@features/auth/store/authStore';
import { EditFieldScreen, useStyledInput } from '@features/settings/components/EditFieldScreen';

export default function EditPhoneScreen() {
  const router = useRouter();
  const { profile, refresh } = useProfile();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const s = useStyledInput();
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
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditFieldScreen
      title="Mobile Number"
      description="Add a number so friends can find you. Numbers must be unique — release it from another account first if needed."
      onSave={save}
      saveDisabled={!canSave}
      saving={saving}>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="+1 555 123 4567"
        placeholderTextColor="#888"
        keyboardType="phone-pad"
        maxLength={16}
        autoFocus
        style={s.input}
      />
      {!formatOk && phone.length > 0 && (
        <Text style={s.error}>Enter a valid number (digits only, optional leading +).</Text>
      )}
    </EditFieldScreen>
  );
}
