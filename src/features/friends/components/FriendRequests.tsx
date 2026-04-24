import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/ui/Avatar';
import { useFriendRequest } from '../hooks/useFriendRequest';
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
    <View className="flex-row items-center px-4 py-3 bg-white">
      <Avatar uri={request.avatar_url} name={request.display_name} size={44} />
      <View className="flex-1 ml-3">
        <Text className="text-black font-semibold">{request.display_name}</Text>
        <Text className="text-gray-500 text-sm">@{request.username}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color="#FFFC00" size="small" />
      ) : (
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={decline}
            hitSlop={8}
            className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
            <Ionicons name="close" size={18} color="#111" />
          </Pressable>
          <Pressable
            onPress={accept}
            className="bg-snap-yellow rounded-full px-4 py-2">
            <Text className="text-black text-xs font-bold">Accept</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function FriendRequests({ requests, onAccepted, onDeclined }: Props) {
  if (requests.length === 0) return null;

  return (
    <View className="bg-white">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-gray-500 text-xs font-semibold uppercase tracking-widest">
          Friend Requests · {requests.length}
        </Text>
      </View>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RequestItem request={item} onAccepted={onAccepted} onDeclined={onDeclined} />
        )}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-100 ml-20" />}
      />
    </View>
  );
}
