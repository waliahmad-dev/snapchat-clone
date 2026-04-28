import React, { useState } from 'react';
import { TextInput, Alert, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@features/auth/store/authStore';
import { deleteAccount } from '@features/auth/utils/accountActions';
import { EditFieldScreen, useStyledInput } from '@features/settings/components/EditFieldScreen';
import { useThemeColors } from '@lib/theme/useThemeColors';

const CONFIRM_PHRASE = 'DELETE';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const username = useAuthStore((s) => s.profile?.username ?? '');
  const s = useStyledInput();
  const c = useThemeColors();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = password.length > 0 && confirm.trim().toUpperCase() === CONFIRM_PHRASE;

  async function onSave() {
    if (!canSave) return;
    Alert.alert(
      'Delete account?',
      'This will permanently delete your account, snaps, stories, memories and chats. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await deleteAccount(password);
              router.replace('/');
            } catch (err) {
              Alert.alert(
                'Could not delete account',
                err instanceof Error ? err.message : 'Please try again.',
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
      title="Delete Account"
      description={`This will permanently delete @${username || 'your account'} and all associated data. This action cannot be undone.`}
      onSave={onSave}
      saveLabel="Delete"
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
          You will lose:
        </Text>
        <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 19 }}>
          • Your profile, name and username (the username will become available to others){'\n'}
          • All snaps, stories and memories{'\n'}
          • All chats and friend connections{'\n'}
          • Your snap score
        </Text>
      </View>

      <Text style={s.label}>Current password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        placeholderTextColor={c.placeholder}
        secureTextEntry
        style={s.input}
      />

      <Text style={s.label}>Type {CONFIRM_PHRASE} to confirm</Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder={CONFIRM_PHRASE}
        placeholderTextColor={c.placeholder}
        autoCapitalize="characters"
        autoCorrect={false}
        style={s.input}
      />
    </EditFieldScreen>
  );
}
