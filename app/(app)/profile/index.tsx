import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useProfile } from '@features/profile/hooks/useProfile';
import { useFriends } from '@features/friends/hooks/useFriends';
import { signOut } from '@features/auth/utils/authHelpers';
import { uploadToStorage, getPublicUrl } from '@lib/supabase/storage';
import { useAuthStore } from '@features/auth/store/authStore';
import { ScreenHeader } from '@components/ui/ScreenHeader';
import { TopDownScreen } from '@components/layout/TopDownScreen';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, loading, updateProfile } = useProfile();
  const { friends } = useFriends();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDisplayName(profile?.display_name ?? '');
    setEditing(true);
  }

  async function saveEdit() {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ display_name: displayName.trim() });
      setEditing(false);
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarPress() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    setSaving(true);
    try {
      const path = `${userId}/${Date.now()}_avatar.jpg`;
      await uploadToStorage('profiles', path, uri);
      const publicUrl = await getPublicUrl('profiles', path);
      await updateProfile({ avatar_url: publicUrl });
    } catch {
      Alert.alert('Upload failed', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); } },
    ]);
  }

  if (loading) {
    return (
      <TopDownScreen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FFFC00" />
        </View>
      </TopDownScreen>
    );
  }

  return (
    <TopDownScreen>
      <ScreenHeader
        title="Profile"
        rightSlot={
          <Pressable onPress={() => router.push('/(app)/settings')} hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color="#111" />
          </Pressable>
        }
      />

      <ScrollView>
        <View className="items-center py-6">
          <Pressable onPress={handleAvatarPress} className="relative">
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                className="w-24 h-24 rounded-full"
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-snap-yellow items-center justify-center">
                <Text className="text-black font-bold text-4xl">
                  {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-black items-center justify-center">
              <Ionicons name="pencil" size={12} color="#fff" />
            </View>
          </Pressable>

          {editing ? (
            <View className="flex-row items-center gap-2 mt-3">
              <TextInput
                className="text-black text-xl font-bold text-center bg-gray-100 rounded-lg px-3 py-1 min-w-40"
                value={displayName}
                onChangeText={setDisplayName}
                autoFocus
              />
              <Pressable onPress={saveEdit} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#FFFC00" size="small" />
                ) : (
                  <Text className="text-black font-bold">Save</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setEditing(false)}>
                <Text className="text-gray-400">Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={startEdit} className="flex-row items-center gap-2 mt-3">
              <Text className="text-black text-xl font-bold">{profile?.display_name}</Text>
              <Ionicons name="pencil" size={14} color="#C7C7CC" />
            </Pressable>
          )}

          <Text className="text-gray-500 text-sm mt-1">@{profile?.username}</Text>
        </View>

        <View className="flex-row justify-around px-8 py-4 mx-4 rounded-xl bg-gray-100">
          <View className="items-center">
            <Text className="text-black font-bold text-xl">{profile?.snap_score ?? 0}</Text>
            <Text className="text-gray-500 text-xs">Snap Score</Text>
          </View>
          <View className="w-px bg-gray-300" />
          <View className="items-center">
            <Text className="text-black font-bold text-xl">{friends.length}</Text>
            <Text className="text-gray-500 text-xs">Friends</Text>
          </View>
        </View>

        <View className="px-4 mt-6 gap-3">
          <ActionRow
            icon="search"
            label="Find Friends"
            onPress={() => router.push('/(app)/search')}
          />
          <ActionRow
            icon="images-outline"
            label="Memories"
            onPress={() => router.push('/(app)/memories')}
          />
          <ActionRow
            icon="log-out-outline"
            label="Sign Out"
            danger
            onPress={handleSignOut}
          />
        </View>
      </ScrollView>
    </TopDownScreen>
  );
}

function ActionRow({
  icon,
  label,
  danger = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-gray-100 rounded-xl px-4 py-4 gap-3">
      <Ionicons name={icon} size={20} color={danger ? '#FF3B30' : '#111'} />
      <Text className={`font-semibold ${danger ? 'text-red-500' : 'text-black'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
