import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@components/ui/Avatar';
import { useFriendRequest } from '../hooks/useFriendRequest';
import { useThemeColors } from '@lib/theme/useThemeColors';
import type { FriendWithStatus } from '../hooks/useFriends';

interface Props {
  requests: FriendWithStatus[];
  onAccepted?: () => void;
  onDeclined?: () => void;
}

function RequestItem({
  request,
  onAccepted,
  onDeclined,
}: {
  request: FriendWithStatus;
  onAccepted?: () => void;
  onDeclined?: () => void;
}) {
  const c = useThemeColors();
  const { t } = useTranslation();
  const { acceptRequest, declineRequest } = useFriendRequest();
  const [loading, setLoading] = React.useState(false);

  async function accept() {
    setLoading(true);
    try {
      await acceptRequest(request.friendshipId);
      onAccepted?.();
    } finally {
      setLoading(false);
    }
  }

  async function decline() {
    setLoading(true);
    try {
      await declineRequest(request.friendshipId);
      onDeclined?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      className="flex-row items-center px-4 py-3"
      style={{ backgroundColor: c.bg }}>
      <Avatar uri={request.avatar_url} name={request.display_name} size={44} />
      <View className="flex-1 ml-3">
        <Text className="font-semibold" style={{ color: c.textPrimary }}>
          {request.display_name}
        </Text>
        <Text className="text-sm" style={{ color: c.textSecondary }}>
          @{request.username}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator color={c.accent} size="small" />
      ) : (
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={decline}
            hitSlop={8}
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{ backgroundColor: c.surfaceElevated }}>
            <Ionicons name="close" size={18} color={c.icon} />
          </Pressable>
          <Pressable
            onPress={accept}
            className="rounded-full px-4 py-2"
            style={{ backgroundColor: c.accent }}>
            <Text className="text-xs font-bold" style={{ color: c.accentText }}>
              {t('search.accept')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function FriendRequests({ requests, onAccepted, onDeclined }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation();
  if (requests.length === 0) return null;

  return (
    <View style={{ backgroundColor: c.bg }}>
      <View className="px-4 pt-4 pb-2">
        <Text
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: c.textSecondary }}>
          {t('search.friendRequestsLabel')} · {requests.length}
        </Text>
      </View>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RequestItem request={item} onAccepted={onAccepted} onDeclined={onDeclined} />
        )}
        scrollEnabled={false}
        ItemSeparatorComponent={() => (
          <View className="h-px ml-20" style={{ backgroundColor: c.divider }} />
        )}
      />
    </View>
  );
}
