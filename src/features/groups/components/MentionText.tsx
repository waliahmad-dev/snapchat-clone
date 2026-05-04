import React from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { tokenizeForRender, type MentionMember } from '../utils/mentions';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  content: string;
  members: MentionMember[];
  baseColor: string;
  highlightColor?: string;
}

export function MentionText({ content, members, baseColor, highlightColor }: Props) {
  const router = useRouter();
  const c = useThemeColors();
  const accent = highlightColor ?? c.accent;
  const tokens = tokenizeForRender(content, members);

  // If the surrounding bubble is the yellow-on-black "self" bubble (baseColor
  // is dark), give mention tokens an inverse pill to keep them obvious; if
  // it's a dark bubble with light text, use the accent colour directly.
  const isLightBubble = isLightColor(baseColor);
  const mentionStyle = isLightBubble
    ? { color: '#000', fontWeight: '800' as const, backgroundColor: 'rgba(0,0,0,0.12)' }
    : { color: accent, fontWeight: '800' as const, backgroundColor: 'rgba(255,252,0,0.18)' };

  return (
    <Text style={{ color: baseColor }}>
      {tokens.map((t, i) =>
        t.type === 'mention' && t.userId ? (
          <Text
            key={`m-${i}`}
            style={mentionStyle}
            onPress={() =>
              router.push({
                pathname: '/(app)/profile/[userId]',
                params: { userId: t.userId! },
              })
            }>
            {t.text}
          </Text>
        ) : (
          <Text key={`t-${i}`}>{t.text}</Text>
        )
      )}
    </Text>
  );
}

function isLightColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}
