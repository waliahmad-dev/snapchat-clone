import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useConversations } from '@features/chat/hooks/useConversations';
import { ConversationRow } from '@features/chat/components/ConversationRow';
import { useFriends, type FriendWithStatus } from '@features/friends/hooks/useFriends';
import { useGroupChats, type GroupChatSummary } from '@features/groups/hooks/useGroupChats';
import { GroupConversationRow } from '@features/groups/components/GroupConversationRow';
import { TopBar } from '@components/ui/TopBar';
import { BOTTOM_NAV_HEIGHT } from '@components/ui/BottomNav';
import { BreathingLoader } from '@components/ui/BreathingLoader';
import { Avatar } from '@components/ui/Avatar';
import { openChatWith } from '@features/chat/utils/openChat';
import { useAuthStore } from '@features/auth/store/authStore';
import { useThemeColors } from '@lib/theme/useThemeColors';
import type { ConversationWithPartner } from '@features/chat/hooks/useConversations';

type FeedItem =
  | { kind: 'conversation'; sortKey: number; data: ConversationWithPartner }
  | { kind: 'group'; sortKey: number; data: GroupChatSummary };

export function ChatListPanel() {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useThemeColors();
  const { conversations, loading: convsLoading, refresh: refreshConvs } = useConversations();
  const { groups, loading: groupsLoading, refresh: refreshGroups } = useGroupChats();
  const { friends, refresh: refreshFriends } = useFriends();
  const profile = useAuthStore((s) => s.profile);

  const loading = convsLoading || groupsLoading;
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshConvs(), refreshGroups(), refreshFriends()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshConvs, refreshGroups, refreshFriends]);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    for (const cv of conversations) {
      const t = cv.lastActivityAt
        ? Date.parse(cv.lastActivityAt)
        : Date.parse(cv.updated_at);
      items.push({ kind: 'conversation', sortKey: t, data: cv });
    }
    for (const g of groups) {
      const t = g.lastMessageAt ? Date.parse(g.lastMessageAt) : 0;
      items.push({ kind: 'group', sortKey: t, data: g });
    }
    items.sort((a, b) => b.sortKey - a.sortKey);
    return items;
  }, [conversations, groups]);

  const { freshFriends } = useMemo(() => {
    const convUserIds = new Set<string>(conversations.map((cv) => cv.partner.id));
    return { freshFriends: friends.filter((f) => !convUserIds.has(f.id)) };
  }, [friends, conversations]);

  const showEmptyState =
    !loading && feed.length === 0 && freshFriends.length === 0;

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
        <TopBar title={t('chat.panel.title')} />
      </SafeAreaView>
      <BreathingLoader active={loading || refreshing} />

      {loading && feed.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.accent} />
        </View>
      ) : showEmptyState ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="chatbubbles-outline" size={56} color={c.iconMuted} />
          <Text className="text-lg font-bold mt-4 mb-1" style={{ color: c.textPrimary }}>
            {t('chat.panel.emptyTitle')}
          </Text>
          <Text className="text-sm text-center" style={{ color: c.textSecondary }}>
            {t('chat.panel.emptyBodyFull')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) =>
            item.kind === 'conversation'
              ? `c:${item.data.id}`
              : `g:${item.data.id}`
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: BOTTOM_NAV_HEIGHT + 80 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
          ItemSeparatorComponent={() => (
            <View className="h-px ml-20" style={{ backgroundColor: c.divider }} />
          )}
          renderItem={({ item }) =>
            item.kind === 'conversation' ? (
              <ConversationRow conversation={item.data} />
            ) : (
              <GroupConversationRow group={item.data} />
            )
          }
          ListFooterComponent={
            freshFriends.length > 0 ? (
              <View>
                {feed.length > 0 && (
                  <View className="px-4 pt-5 pb-2" style={{ backgroundColor: c.bg }}>
                    <Text
                      className="text-xs font-semibold uppercase tracking-widest"
                      style={{ color: c.textSecondary }}>
                      {t('chat.panel.newFriendsLabel')} · {freshFriends.length}
                    </Text>
                  </View>
                )}
                {freshFriends.map((f) => (
                  <NewFriendRow
                    key={f.id}
                    friend={f}
                    onOpen={() => profile && openChatWith(profile.id, f)}
                  />
                ))}
              </View>
            ) : null
          }
        />
      )}

      {/* New Chat FAB */}
      <Pressable
        onPress={() => router.push('/(app)/chat/new')}
        android_ripple={{ color: c.rowPress, borderless: true }}
        style={{
          position: 'absolute',
          right: 20,
          bottom: BOTTOM_NAV_HEIGHT + 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}>
        <Ionicons name="create" size={26} color={c.accentText} />
      </Pressable>
    </View>
  );
}

function NewFriendRow({
  friend,
  onOpen,
}: {
  friend: FriendWithStatus;
  onOpen: () => void;
}) {
  const c = useThemeColors();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onOpen}
      android_ripple={{ color: c.rowPress }}
      className="flex-row items-center px-4 py-3"
      style={{ backgroundColor: c.bg }}>
      <Avatar uri={friend.avatar_url} name={friend.display_name} size={48} />
      <View className="flex-1 mx-3">
        <Text
          className="font-semibold text-base"
          style={{ color: c.textPrimary }}
          numberOfLines={1}>
          {friend.display_name}
        </Text>
        <Text
          className="text-sm font-semibold"
          style={{ color: c.accent }}
          numberOfLines={1}>
          {t('chat.panel.sayHiTo', { name: friend.display_name.split(' ')[0] })}
        </Text>
      </View>
      <View className="w-9 h-9 rounded-full items-center justify-center">
        <Ionicons name="chatbubble-outline" size={20} color={c.icon} />
      </View>
    </Pressable>
  );
}
