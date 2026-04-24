import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfile } from '@features/profile/hooks/useProfile';
import { useFriendRequest } from '@features/friends/hooks/useFriendRequest';
import { ProfileHeader } from '@features/profile/components/ProfileHeader';
import { useAuthStore } from '@features/auth/store/authStore';
import * as Haptics from 'expo-haptics';

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { profile, loading } = useProfile(userId);
  const currentUser = useAuthStore((s) => s.profile);
  const { sendRequest, unfriendAndPurge, blockUser, getFriendshipStatus } =
    useFriendRequest();
  const [actionLoading, setActionLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  React.useEffect(() => {
    if (!currentUser || !userId) return;
    let cancelled = false;
    setStatusLoaded(false);
    getFriendshipStatus(userId).then(({ status, friendshipId: fid }) => {
      if (cancelled) return;
      setFriendshipStatus(status);
      setFriendshipId(fid);
      setStatusLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, currentUser?.id]);

  async function handleAdd() {
    setActionLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sendRequest(userId);
      setSent(true);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function handleUnfriend() {
    if (!profile || !friendshipId) return;
    const handle = profile.username ? `@${profile.username}` : profile.display_name;
    Alert.alert(
      `Unfriend ${handle}?`,
      'All of your messages, snaps, and shared media will be cleared. They can still find you in search.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
              await unfriendAndPurge(friendshipId, userId);
              setFriendshipStatus(null);
              setFriendshipId(null);
              router.back();
            } catch (err: any) {
              Alert.alert('Could not unfriend', err.message ?? 'Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }

  function handleBlock() {
    if (!profile || !currentUser) return;
    const handle = profile.username ? `@${profile.username}` : profile.display_name;
    Alert.alert(
      `Block ${handle}?`,
      'All your messages, snaps, and shared media will be cleared, and they will no longer appear in your search.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
              await blockUser(friendshipId, userId);
              router.back();
            } catch (err: any) {
              Alert.alert('Could not block', err.message ?? 'Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }

  if (loading || !profile) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="#FFFC00" />
      </View>
    );
  }

  const isPending = sent || friendshipStatus === 'pending';
  const isAccepted = friendshipStatus === 'accepted';

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView>
        <View className="flex-row items-center px-4 py-4">
          <Pressable onPress={() => router.back()}>
            <Text className="text-white text-2xl">‹</Text>
          </Pressable>
        </View>

        <ProfileHeader profile={profile} friendCount={0} editable={false} />

        <View className="px-6 flex-row gap-3 justify-center mt-2">
          {!statusLoaded ? (
            <View className="flex-1 bg-white/10 rounded-full py-3 items-center">
              <ActivityIndicator color="#FFFC00" size="small" />
            </View>
          ) : isAccepted ? (
            <Pressable
              onPress={handleUnfriend}
              disabled={actionLoading}
              className="flex-1 bg-white/10 rounded-full py-3 items-center">
              {actionLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white font-bold">✓ Friends</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={!isPending ? handleAdd : undefined}
              disabled={isPending || actionLoading}
              className={`flex-1 rounded-full py-3 items-center ${isPending ? 'bg-white/10' : 'bg-snap-yellow'}`}>
              {actionLoading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text className={`font-bold ${isPending ? 'text-white/50' : 'text-black'}`}>
                  {isPending ? 'Pending' : 'Add Friend'}
                </Text>
              )}
            </Pressable>
          )}

          <Pressable
            onPress={handleBlock}
            className="px-4 rounded-full py-3 bg-white/10 items-center">
            <Text className="text-snap-danger font-semibold text-sm">Block</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
