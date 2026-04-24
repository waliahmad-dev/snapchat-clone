import React from 'react';
import { View, Text } from 'react-native';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import type { DbMessage } from '@/types/database';

interface Props {
  message: DbMessage;
}

export function SystemEventBubble({ message }: Props) {
  const content = message.content ?? '';
  const isStreak = /streak/i.test(content);

  return (
    <View className="items-center my-3">
      <View
        className={`px-4 py-1.5 rounded-full ${isStreak ? 'bg-snap-yellow/20' : 'bg-white/10'}`}>
        <Text
          className={`text-sm font-semibold ${isStreak ? 'text-snap-yellow' : 'text-white/70'}`}>
          {content}
        </Text>
      </View>
      <Text className="text-white/30 text-[10px] mt-1">
        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
      </Text>
    </View>
  );
}
