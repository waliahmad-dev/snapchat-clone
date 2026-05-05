import React, { useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getSignedUrl } from '@lib/supabase/storage';
import type { DbMessage } from '@/types/database';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  message: DbMessage;
  isOwn: boolean;
  onMarkViewed: (messageId: string) => void;
  onSave: (messageId: string) => void;
}

type ViewState = 'unopened' | 'loading' | 'open' | 'viewed';

export function SnapReceived({ message, isOwn, onMarkViewed, onSave }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation();
  const [viewState, setViewState] = useState<ViewState>(
    message.viewed_at ? 'viewed' : 'unopened'
  );
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [hideTimer, setHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  async function handleOpen() {
    if (viewState !== 'unopened' || isOwn) return;
    setViewState('loading');

    try {
      const url = await getSignedUrl('snaps', message.media_url!);
      setImageUri(url);
      setViewState('open');
      onMarkViewed(message.id);

      const timer = setTimeout(() => {
        setViewState('viewed');
        setImageUri(null);
      }, 10_000);
      setHideTimer(timer);
    } catch {
      setViewState('unopened');
    }
  }

  function handleRelease() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      setHideTimer(null);
    }
    setViewState('viewed');
    setImageUri(null);
  }

  if (viewState === 'open' && imageUri) {
    return (
      <Pressable style={StyleSheet.absoluteFill} onPressOut={handleRelease}>
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View className="absolute bottom-24 right-4">
          <Pressable
            onPress={() => onSave(message.id)}
            className="rounded-full px-3 py-2"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <Text className="text-xs font-bold" style={{ color: '#FFFFFF' }}>
              {t('chat.snap.save')}
            </Text>
          </Pressable>
        </View>
        <View className="absolute top-16 left-0 right-0 items-center">
          <Text className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {t('chat.snap.holdHint')}
          </Text>
        </View>
      </Pressable>
    );
  }

  if (viewState === 'loading') {
    return (
      <View
        className="self-start ml-4 my-1 rounded-2xl px-4 py-3 flex-row items-center gap-2"
        style={{
          backgroundColor:
            c.scheme === 'dark' ? 'rgba(255,252,0,0.2)' : 'rgba(255,204,0,0.18)',
        }}>
        <ActivityIndicator color={c.accent} size="small" />
        <Text className="text-sm" style={{ color: c.accent }}>
          {t('chat.snap.loading')}
        </Text>
      </View>
    );
  }

  const isSentByMe = isOwn;
  const isViewed = viewState === 'viewed';
  const pillBg = isViewed ? c.surfaceElevated : c.accent;
  const pillText = isViewed ? c.textMuted : c.accentText;

  return (
    <Pressable
      onPress={handleOpen}
      disabled={isSentByMe || isViewed}
      className={`my-1 rounded-2xl px-4 py-3 ${isSentByMe ? 'self-end mr-4' : 'self-start ml-4'}`}
      style={{ backgroundColor: pillBg }}>
      <Text className="text-sm font-bold" style={{ color: pillText }}>
        {isSentByMe
          ? isViewed
            ? t('chat.snap.statusOpened')
            : t('chat.snap.statusSent')
          : isViewed
            ? t('chat.snap.statusViewed')
            : t('chat.snap.statusTapToOpen')}
      </Text>
    </Pressable>
  );
}
