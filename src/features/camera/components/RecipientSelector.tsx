import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import { useCameraStore } from '../store/cameraStore';
import { sendSnapToRecipients } from '../utils/sendSnap';
import type { DbUser, DbFriendship } from '@/types/database';
import * as Haptics from 'expo-haptics';

interface Props {
  imageUri: string;
  onClose: () => void;
}

export function RecipientSelector({ imageUri, onClose }: Props) {
  const [friends, setFriends] = useState<DbUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendToStory, setSendToStory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const profile = useAuthStore((s) => s.profile);
  const { reset } = useCameraStore();

  React.useEffect(() => {
    loadFriends();
  }, []);

  async function loadFriends() {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`);

      if (!friendships) return;

      const friendIds = friendships.map((f: Pick<DbFriendship, 'requester_id' | 'addressee_id'>) =>
        f.requester_id === profile.id ? f.addressee_id : f.requester_id
      );

      if (friendIds.length === 0) return;

      const { data: users } = await supabase
        .from('users')
        .select('*')
        .in('id', friendIds);

      setFriends(users ?? []);
    } finally {
      setLoading(false);
    }
  }

  function toggleRecipient(id: string) {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (!profile || (selected.size === 0 && !sendToStory)) return;

    setSending(true);
    try {
      await sendSnapToRecipients({
        senderId: profile.id,
        senderName: profile.display_name,
        imageUri,
        recipientIds: Array.from(selected),
        postToMyStory: sendToStory,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onClose();
    } catch (err) {
      console.error('[Snap send]', err);
      Alert.alert(
        'Could not send',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-white/10">
          <Pressable onPress={onClose}>
            <Text className="text-snap-yellow text-base">Cancel</Text>
          </Pressable>
          <Text className="text-white font-bold text-base">Send To</Text>
          <Pressable
            onPress={handleSend}
            disabled={sending || (selected.size === 0 && !sendToStory)}>
            {sending ? (
              <ActivityIndicator color="#FFFC00" />
            ) : (
              <Text
                className={`font-bold text-base ${selected.size > 0 || sendToStory ? 'text-snap-yellow' : 'text-white/30'}`}>
                Send
              </Text>
            )}
          </Pressable>
        </View>

        <Pressable
          onPress={() => setSendToStory((v) => !v)}
          className="flex-row items-center px-4 py-4 border-b border-white/10">
          <View className="w-12 h-12 rounded-full bg-snap-yellow items-center justify-center mr-4">
            <Text className="text-2xl">📖</Text>
          </View>
          <Text className="text-white font-semibold flex-1">My Story</Text>
          <View
            className={`w-6 h-6 rounded-full border-2 items-center justify-center ${sendToStory ? 'bg-snap-yellow border-snap-yellow' : 'border-white/40'}`}>
            {sendToStory && <Text className="text-black text-xs">✓</Text>}
          </View>
        </Pressable>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FFFC00" />
          </View>
        ) : friends.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-white/50 text-center">
              Add friends to send snaps to them!
            </Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selected.has(item.id);
              return (
                <Pressable
                  onPress={() => toggleRecipient(item.id)}
                  className="flex-row items-center px-4 py-3 border-b border-white/5">
                  <View className="w-12 h-12 rounded-full bg-snap-surface items-center justify-center mr-4">
                    <Text className="text-white font-bold text-base">
                      {item.display_name[0].toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold">{item.display_name}</Text>
                    <Text className="text-snap-gray text-sm">@{item.username}</Text>
                  </View>
                  <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? 'bg-snap-yellow border-snap-yellow' : 'border-white/40'}`}>
                    {isSelected && <Text className="text-black text-xs">✓</Text>}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
