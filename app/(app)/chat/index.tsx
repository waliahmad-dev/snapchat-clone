import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useConversations } from '@features/chat/hooks/useConversations';
import { ConversationRow } from '@features/chat/components/ConversationRow';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function ChatListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useThemeColors();
  const { conversations, loading } = useConversations();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }} edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-2xl" style={{ color: c.textPrimary }}>
            ‹
          </Text>
        </Pressable>
        <Text className="font-bold text-xl tracking-tight" style={{ color: c.textPrimary }}>
          {t('chat.panel.title')}
        </Text>
        <View className="w-9 h-9" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.accent} />
        </View>
      ) : conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">👻</Text>
          <Text className="text-xl font-bold mb-2" style={{ color: c.textPrimary }}>
            {t('chat.panel.emptyTitle')}
          </Text>
          <Text className="text-sm text-center" style={{ color: c.textSecondary }}>
            {t('chat.panel.emptyBodyShort')}
          </Text>
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
