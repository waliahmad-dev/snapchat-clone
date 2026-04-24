import React, { useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { getSignedUrl } from '@lib/supabase/storage';
import type { DbMessage } from '@/types/database';

interface Props {
  message: DbMessage;
  isOwn: boolean;
  onMarkViewed: (messageId: string) => void;
  onSave: (messageId: string) => void;
}

type ViewState = 'unopened' | 'loading' | 'open' | 'viewed';

export function SnapReceived({ message, isOwn, onMarkViewed, onSave }: Props) {
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
            className="bg-black/60 rounded-full px-3 py-2">
            <Text className="text-white text-xs font-bold">SAVE</Text>
          </Pressable>
        </View>
        <View className="absolute top-16 left-0 right-0 items-center">
          <Text className="text-white/60 text-xs">Hold to view • Release to close</Text>
        </View>
      </Pressable>
    );
  }

  if (viewState === 'loading') {
    return (
      <View className="self-start ml-4 my-1 rounded-2xl bg-snap-yellow/20 px-4 py-3 flex-row items-center gap-2">
        <ActivityIndicator color="#FFFC00" size="small" />
        <Text className="text-snap-yellow text-sm">Loading snap…</Text>
      </View>
    );
  }

  const isSentByMe = isOwn;

  return (
    <Pressable
      onPress={handleOpen}
      disabled={isSentByMe || viewState === 'viewed'}
      className={`
        self-${isSentByMe ? 'end mr-4' : 'start ml-4'} my-1
        rounded-2xl px-4 py-3
        ${viewState === 'viewed' ? 'bg-white/10' : 'bg-snap-yellow'}
      `}>
      <Text className={`text-sm font-bold ${viewState === 'viewed' ? 'text-white/40' : 'text-black'}`}>
        {isSentByMe
          ? viewState === 'viewed'
            ? '📷 Snap Opened'
            : '📷 Snap Sent'
          : viewState === 'viewed'
          ? '📷 Snap Viewed'
          : '📷 Tap to Open'}
      </Text>
    </Pressable>
  );
}
