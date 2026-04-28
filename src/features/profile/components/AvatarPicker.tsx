import React from 'react';
import { Pressable, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '@components/ui/Avatar';
import { uploadToStorage, getPublicUrl } from '@lib/supabase/storage';
import { useAuthStore } from '@features/auth/store/authStore';
import { useProfile } from '@features/profile/hooks/useProfile';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  size?: number;
}

export function AvatarPicker({ size = 96 }: Props) {
  const c = useThemeColors();
  const profile = useAuthStore((s) => s.profile);
  const { updateProfile } = useProfile();
  const [uploading, setUploading] = React.useState(false);

  async function handlePress() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0] || !profile) return;

    setUploading(true);
    try {
      const path = `${profile.id}/${Date.now()}_avatar.jpg`;
      await uploadToStorage('profiles', path, result.assets[0].uri);
      const publicUrl = await getPublicUrl('profiles', path);
      await updateProfile({ avatar_url: publicUrl });
    } catch (err: any) {
      Alert.alert('Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Pressable onPress={handlePress} className="relative">
      {uploading ? (
        <ActivityIndicator color={c.accent} style={{ width: size, height: size }} />
      ) : (
        <Avatar uri={profile?.avatar_url} name={profile?.display_name ?? '?'} size={size} />
      )}
    </Pressable>
  );
}
