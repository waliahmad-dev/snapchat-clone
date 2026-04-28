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
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  onSend: (text: string, replyToMessageId?: string | null) => Promise<void>;
  onCameraPress: () => void;
}

export function ChatInput({ onSend, onCameraPress }: Props) {
  const c = useThemeColors();
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
        <View
          className="flex-row items-center px-3 py-2 border-t"
          style={{ backgroundColor: c.surface, borderColor: c.divider }}>
          <View
            className="w-1 h-8 rounded-full mr-3"
            style={{ backgroundColor: c.accent }}
          />
          <View className="flex-1">
            <Text className="text-xs font-bold" style={{ color: c.accent }}>
              Replying to {replyTarget.authorName}
            </Text>
            <Text
              className="text-xs mt-0.5"
              numberOfLines={1}
              style={{ color: c.textSecondary }}>
              {replyTarget.preview}
            </Text>
          </View>
          <Pressable onPress={clearReply} hitSlop={10} className="ml-2 p-1">
            <Ionicons name="close" size={18} color={c.icon} />
          </Pressable>
        </View>
      )}

      <View
        className="flex-row items-center px-3 py-3 border-t"
        style={{ backgroundColor: c.bg, borderColor: c.border }}>
        <Pressable
          onPress={onCameraPress}
          className="w-10 h-10 rounded-full items-center justify-center mr-2"
          style={{ backgroundColor: c.surfaceElevated }}>
          <Ionicons name="camera" size={20} color={c.icon} />
        </Pressable>

        <TextInput
          className="flex-1 rounded-full px-4 py-2 text-base"
          style={{ backgroundColor: c.inputBg, color: c.textPrimary }}
          placeholder={replyTarget ? `Reply to ${replyTarget.authorName}…` : 'Send a chat…'}
          placeholderTextColor={c.placeholder}
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
            className="w-10 h-10 rounded-full items-center justify-center ml-2"
            style={{ backgroundColor: c.accent }}>
            <Ionicons name="arrow-up" size={20} color={c.accentText} />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
