import React, { useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@lib/supabase/client';
import { uploadToStorage } from '@lib/supabase/storage';
import { useAuthStore } from '@features/auth/store/authStore';

interface Props {
  capturedUri: string;
  onDone: () => void;
  onCancel: () => void;
}

export function StoryCreator({ capturedUri, onDone, onCancel }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const [posting, setPosting] = useState(false);

  async function postStory() {
    if (!profile) return;
    setPosting(true);
    try {
      const path = `${profile.id}/${Date.now()}.jpg`;
      await uploadToStorage('stories', path, capturedUri);

      const { error } = await supabase.from('stories').insert({
        user_id: profile.id,
        media_url: path,
      });

      if (error) throw error;
      onDone();
    } catch (err: any) {
      Alert.alert('Failed to post story', err.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-black/60 rounded-2xl mx-4">
      <Text className="text-white font-semibold">Add to My Story</Text>
      <View className="flex-row gap-3">
        <Pressable onPress={onCancel} disabled={posting} className="px-4 py-2 rounded-full bg-white/10">
          <Text className="text-white text-sm font-semibold">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={postStory}
          disabled={posting}
          className="px-4 py-2 rounded-full bg-snap-yellow">
          {posting ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text className="text-black text-sm font-bold">Post</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
