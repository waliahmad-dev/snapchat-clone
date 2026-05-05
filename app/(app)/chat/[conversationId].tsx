import React, { useEffect, useId, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, AppState } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useTranslation } from 'react-i18next';
import { useMessages } from '@features/chat/hooks/useMessages';
import { useScreenshotDetection } from '@features/chat/hooks/useScreenshotDetection';
import { useStreak } from '@features/chat/hooks/useStreak';
import { setChatPresence } from '@features/chat/utils/chatPresence';
import { MessageBubble } from '@features/chat/components/MessageBubble';
import { ChatInput } from '@features/chat/components/ChatInput';
import { SnapSequencePlayer } from '@features/chat/components/SnapSequencePlayer';
import { useReplyStore } from '@features/chat/store/replyStore';
import { Avatar } from '@components/ui/Avatar';
import { useAuthStore } from '@features/auth/store/authStore';
import { useCameraStore } from '@features/camera/store/cameraStore';
import { supabase } from '@lib/supabase/client';
import { database } from '@lib/watermelondb/database';
import Friend from '@lib/watermelondb/models/Friend';
import { useThemeColors } from '@lib/theme/useThemeColors';
import type { DbUser } from '@/types/database';

export default function ConversationScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useThemeColors();
  const params = useLocalSearchParams<{
    conversationId: string;
    friendId: string;
    friendName: string;
    autoSnapIds?: string;
  }>();
  const profile = useAuthStore((s) => s.profile);
  const instanceId = useId();
  const {
    messages,
    loading,
    sendTextMessage,
    markViewed,
    softDeleteMessage,
    setMessageSaved,
    postSystemMessage,
    markAllReceivedAsViewed,
    hideViewedReceivedOnLeave,
  } = useMessages(params.conversationId);
  const streak = useStreak(profile?.id ?? '', params.friendId);

  const [friend, setFriend] = useState<DbUser | null>(null);

  const [snapQueue] = useState<string[]>(() =>
    params.autoSnapIds ? params.autoSnapIds.split(',').filter(Boolean) : []
  );
  const [playerOpen, setPlayerOpen] = useState(snapQueue.length > 0);

  useScreenshotDetection(params.conversationId);

  useEffect(() => {
    if (!params.friendId) return;
    const sub = database
      .get<Friend>('friends')
      .query(Q.where('user_id', params.friendId))
      .observe()
      .subscribe((rows) => {
        if (rows.length === 0) return;
        const row = rows[0];
        setFriend({
          id: row.userId,
          username: row.username,
          display_name: row.displayName,
          avatar_url: row.avatarUrl,
          snap_score: row.snapScore,
          date_of_birth: null,
          phone: null,
          created_at: new Date(row.createdAt).toISOString(),
        });
      });

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', params.friendId)
          .maybeSingle();
        if (cancelled || !data) return;
        setFriend((prev) => prev ?? (data as DbUser));
      } catch {
        // offline — local friends cache already populated the header
      }
    })();

    return () => {
      cancelled = true;
      sub.unsubscribe();
    };
  }, [params.friendId, router]);

  useEffect(() => {
    if (!profile || !params.friendId) return;
    let cancelled = false;

    async function ensureStillFriends() {
      if (!profile) return;
      const { data } = await supabase
        .from('friendships')
        .select('id, status')
        .or(
          `and(requester_id.eq.${profile.id},addressee_id.eq.${params.friendId}),` +
            `and(requester_id.eq.${params.friendId},addressee_id.eq.${profile.id})`
        )
        .maybeSingle();
      if (cancelled) return;
      if (!data || data.status !== 'accepted') {
        router.replace('/(app)/chat');
      }
    }

    const sub = supabase
      .channel(`friendship-watch:${profile.id}:${params.friendId}:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () =>
        ensureStillFriends()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(sub);
    };
  }, [profile?.id, params.friendId, router, instanceId]);

  useEffect(() => {
    markAllReceivedAsViewed();
  }, [markAllReceivedAsViewed]);

  // Presence + local-hide lifecycle for the unsaved-chat spec:
  //   - Mount / foreground while screen is active = "in chat"
  //   - Unmount / backgrounding             = "out of chat"
  // The leave path also locally hides any unsaved received messages the user
  // already viewed, so they disappear from this device's view immediately.
  // The server cleanup of message rows is driven by a Postgres trigger on
  // chat_presence — it only fires once *both* participants are out, so the
  // sender never sees content vanish while they're still active.
  const presenceUserId = profile?.id;
  const presenceConversationId = params.conversationId;
  const presenceActiveRef = useRef(false);
  useEffect(() => {
    if (!presenceUserId || !presenceConversationId) return;

    setChatPresence(presenceConversationId, presenceUserId, true);
    presenceActiveRef.current = true;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (!presenceActiveRef.current) {
          setChatPresence(presenceConversationId, presenceUserId, true);
          presenceActiveRef.current = true;
        }
      } else if (state === 'background' && presenceActiveRef.current) {
        // Treat backgrounding (not transient 'inactive' from a notification
        // pull / control center) as leaving, so a force-quit from the app
        // switcher doesn't strand presence as in_chat=true on the server.
        void hideViewedReceivedOnLeave();
        setChatPresence(presenceConversationId, presenceUserId, false);
        presenceActiveRef.current = false;
      }
    });

    return () => {
      sub.remove();
      void hideViewedReceivedOnLeave();
      if (presenceActiveRef.current) {
        setChatPresence(presenceConversationId, presenceUserId, false);
        presenceActiveRef.current = false;
      }
    };
  }, [presenceUserId, presenceConversationId, hideViewedReceivedOnLeave]);

  useEffect(() => {
    return () => useReplyStore.getState().clear();
  }, []);

  async function handleSend(text: string, replyToMessageId?: string | null) {
    await sendTextMessage(text, replyToMessageId ?? null);
  }

  if (!profile) return null;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }} edges={['top']}>
      <View
        className="flex-row items-center gap-2 border-b px-3 py-3"
        style={{ borderColor: c.border }}>
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center"
          hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={c.icon} />
        </Pressable>

        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(app)/profile/[userId]',
              params: { userId: params.friendId },
            })
          }
          className="flex-1 flex-row items-center gap-2"
          hitSlop={6}>
          <Avatar uri={friend?.avatar_url ?? null} name={params.friendName ?? '?'} size={34} />
          <Text
            className="flex-shrink text-base font-bold"
            style={{ color: c.textPrimary }}
            numberOfLines={1}>
            {params.friendName}
          </Text>
          {streak && streak.count > 0 && (
            <View
              className="flex-row items-center rounded-full px-2 py-0.5"
              style={{ backgroundColor: c.surfaceElevated }}>
              <Text className="text-sm font-bold" style={{ color: c.accent }}>
                {streak.count}
              </Text>
              <Text className="ml-0.5 text-base">🔥</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            useCameraStore.getState().setDirectRecipient({
              id: params.friendId,
              displayName: params.friendName ?? t('common.friend'),
            });
            router.push('/(app)/camera');
          }}
          className="h-9 w-9 items-center justify-center"
          hitSlop={8}>
          <Ionicons name="camera-outline" size={24} color={c.icon} />
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.accent} />
        </View>
      ) : messages.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 py-12">
          <Text className="mb-3 text-5xl">👋</Text>
          <Text className="mb-1 text-lg font-bold" style={{ color: c.textPrimary }}>
            {t('chat.conversation.newFriendTitle', { name: params.friendName })}
          </Text>
          <Text className="text-center text-sm" style={{ color: c.textSecondary }}>
            {t('chat.conversation.newFriendBody')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => {
            const isOwn = item.sender_id === profile.id;
            const authorName = isOwn
              ? (profile.display_name ?? t('common.you'))
              : (params.friendName ?? t('common.they'));
            return (
              <MessageBubble
                message={item}
                isOwn={isOwn}
                authorName={authorName}
                onMarkViewed={markViewed}
                onSetSaved={setMessageSaved}
                onDelete={softDeleteMessage}
                onPostSystem={postSystemMessage}
              />
            );
          }}
        />
      )}

      {playerOpen && snapQueue.length > 0 && (
        <SnapSequencePlayer
          messageIds={snapQueue}
          myName={profile.display_name ?? t('common.you')}
          conversationId={params.conversationId}
          onFinish={() => setPlayerOpen(false)}
        />
      )}

      <ChatInput
        onSend={handleSend}
        onCameraPress={() => {
          useCameraStore.getState().setDirectRecipient({
            id: params.friendId,
            displayName: params.friendName ?? 'Friend',
          });
          router.push('/(app)/camera');
        }}
      />
    </SafeAreaView>
  );
}
