import React from 'react';
import { View, Text } from 'react-native';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { useTranslation } from 'react-i18next';
import type { DbMessage } from '@/types/database';
import { useThemeColors } from '@lib/theme/useThemeColors';
import { decodeSystemEvent } from '@lib/i18n/systemEvent';

interface Props {
  message: DbMessage;
}

export function SystemEventBubble({ message }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation();

  // Translate at render time so every reader sees the event in their own
  // locale, not the sender's.
  const evt = decodeSystemEvent(message.content);
  const content = evt ? t(evt.key, evt.args ?? {}) : (message.content ?? '');
  const isStreak = /streak/i.test(content);

  const pillBg = isStreak
    ? c.scheme === 'dark'
      ? 'rgba(255,252,0,0.2)'
      : 'rgba(255,204,0,0.18)'
    : c.surfaceElevated;
  const textColor = isStreak ? c.accent : c.textSecondary;

  return (
    <View className="items-center my-3">
      <View className="px-4 py-1.5 rounded-full" style={{ backgroundColor: pillBg }}>
        <Text className="text-sm font-semibold" style={{ color: textColor }}>
          {content}
        </Text>
      </View>
      <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 4 }}>
        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
      </Text>
    </View>
  );
}
