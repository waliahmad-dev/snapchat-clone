import React, { useState } from 'react';
import { TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useProfile } from '@features/profile/hooks/useProfile';
import { EditFieldScreen, useStyledInput } from '@features/settings/components/EditFieldScreen';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function EditNameScreen() {
  const router = useRouter();
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
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditFieldScreen
      title="Name"
      description="Your name is shown to friends. It can be changed at any time."
      onSave={save}
      saveDisabled={!valid || !dirty}
      saving={saving}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor={c.placeholder}
        maxLength={50}
        autoFocus
        style={s.input}
      />
    </EditFieldScreen>
  );
}
