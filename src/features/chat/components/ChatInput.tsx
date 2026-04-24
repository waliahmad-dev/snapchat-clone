import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useReplyStore } from '../store/replyStore';

interface Props {
  onSend: (text: string, replyToMessageId?: string | null) => Promise<void>;
  onCameraPress: () => void;
}

export function ChatInput({ onSend, onCameraPress }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const replyTarget = useReplyStore((s) => s.target);
  const clearReply = useReplyStore((s) => s.clear);

  async function handleSend() {
    if (!text.trim() || sending) return;
    const message = text.trim();
    const replyId = replyTarget?.messageId ?? null;
    setText('');
    setSending(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await onSend(message, replyId);
      clearReply();
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      {replyTarget && (
        <View className="flex-row items-center px-3 py-2 bg-snap-surface border-t border-white/5">
          <View className="w-1 h-8 bg-snap-yellow rounded-full mr-3" />
          <View className="flex-1">
            <Text className="text-snap-yellow text-xs font-bold">
              Replying to {replyTarget.authorName}
            </Text>
            <Text className="text-white/70 text-xs mt-0.5" numberOfLines={1}>
              {replyTarget.preview}
            </Text>
          </View>
          <Pressable onPress={clearReply} hitSlop={10} className="ml-2 p-1">
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>
      )}

      <View className="flex-row items-center px-3 py-3 border-t border-white/10 bg-black">
        <Pressable
          onPress={onCameraPress}
          className="w-10 h-10 rounded-full bg-snap-surface items-center justify-center mr-2">
          <Ionicons name="camera" size={20} color="#fff" />
        </Pressable>

        <TextInput
          className="flex-1 bg-snap-surface text-white rounded-full px-4 py-2 text-base"
          placeholder={replyTarget ? `Reply to ${replyTarget.authorName}…` : 'Send a chat…'}
          placeholderTextColor="#8A8A8A"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />

        {text.trim().length > 0 && (
          <Pressable
            onPress={handleSend}
            disabled={sending}
            className="w-10 h-10 rounded-full bg-snap-yellow items-center justify-center ml-2">
            <Ionicons name="arrow-up" size={20} color="#000" />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
