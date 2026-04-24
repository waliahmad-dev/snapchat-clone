import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConversations } from '@features/chat/hooks/useConversations';
import { ConversationRow } from '@features/chat/components/ConversationRow';
import { useAuthStore } from '@features/auth/store/authStore';

export default function ChatListScreen() {
  const router = useRouter();
  const { conversations, loading } = useConversations();
  const profile = useAuthStore((s) => s.profile);

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-white text-2xl">‹</Text>
        </Pressable>
        <Text className="text-white font-bold text-xl tracking-tight">Chat</Text>
        <Pressable
          onPress={() => router.push('/(app)/search')}
          className="w-9 h-9 bg-white/10 rounded-full items-center justify-center"
          hitSlop={8}>
          <Text className="text-white text-base">🔍</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FFFC00" />
        </View>
      ) : conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white text-5xl mb-4">👻</Text>
          <Text className="text-white text-xl font-bold mb-2">No chats yet</Text>
          <Text className="text-snap-gray text-sm text-center">
            Add friends and start snapping!
          </Text>
          <Pressable
            onPress={() => router.push('/(app)/search')}
            className="mt-5 bg-snap-yellow rounded-full px-8 py-3">
            <Text className="text-black font-bold">Find Friends</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationRow conversation={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}
