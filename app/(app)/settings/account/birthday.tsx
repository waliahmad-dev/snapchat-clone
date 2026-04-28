import React, { useState } from 'react';
import { TextInput, Alert, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useProfile } from '@features/profile/hooks/useProfile';
import { ageFromIso, MIN_AGE_YEARS } from '@features/auth/utils/accountActions';
import { EditFieldScreen, useStyledInput } from '@features/settings/components/EditFieldScreen';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function EditBirthdayScreen() {
  const router = useRouter();
  const { profile, updateProfile } = useProfile();
  const s = useStyledInput();
  const c = useThemeColors();
  const parsed = profile?.date_of_birth
    ? /^(\d{4})-(\d{2})-(\d{2})/.exec(profile.date_of_birth)
    : null;
  const [year, setYear] = useState(parsed ? parsed[1] : '');
  const [month, setMonth] = useState(parsed ? parsed[2] : '');
  const [day, setDay] = useState(parsed ? parsed[3] : '');
  const [saving, setSaving] = useState(false);

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  const dateOk =
    Number.isFinite(y) &&
    y >= 1900 &&
    y <= new Date().getFullYear() &&
    Number.isFinite(m) &&
    m >= 1 &&
    m <= 12 &&
    Number.isFinite(d) &&
    d >= 1 &&
    d <= 31;

  const iso = dateOk
    ? `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    : null;
  const age = iso ? ageFromIso(iso) : null;
  const tooYoung = age !== null && age < MIN_AGE_YEARS;
  const dirty = iso !== profile?.date_of_birth;
  const canSave = dateOk && !tooYoung && dirty;

  async function save() {
    if (!canSave || !iso) return;
    setSaving(true);
    try {
      await updateProfile({ date_of_birth: iso });
      router.back();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditFieldScreen title="Birthday" onSave={save} saveDisabled={!canSave} saving={saving}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={year}
          onChangeText={setYear}
          placeholder="YYYY"
          placeholderTextColor={c.placeholder}
          keyboardType="number-pad"
          maxLength={4}
          style={[s.input, { flex: 1.2, textAlign: 'center' }]}
        />
        <TextInput
          value={month}
          onChangeText={setMonth}
          placeholder="MM"
          placeholderTextColor={c.placeholder}
          keyboardType="number-pad"
          maxLength={2}
          style={[s.input, { flex: 0.8, textAlign: 'center' }]}
        />
        <TextInput
          value={day}
          onChangeText={setDay}
          placeholder="DD"
          placeholderTextColor={c.placeholder}
          keyboardType="number-pad"
          maxLength={2}
          style={[s.input, { flex: 0.8, textAlign: 'center' }]}
        />
      </View>

      {tooYoung && (
        <Text style={s.error}>You must be at least {MIN_AGE_YEARS} years old to use Snapchat.</Text>
      )}
      {!tooYoung && age !== null && <Text style={s.hint}>Age: {age}</Text>}
    </EditFieldScreen>
  );
}
