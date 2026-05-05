import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useReplyStore } from '@features/chat/store/replyStore';
import { Avatar } from '@components/ui/Avatar';
import { useThemeColors } from '@lib/theme/useThemeColors';
import { activeMentionPrefix, parseMentions, type MentionMember } from '../utils/mentions';

interface Props {
  onSend: (
    text: string,
    mentions: string[],
    replyToMessageId: string | null
  ) => Promise<void>;
  onCameraPress: () => void;
  members: MentionMember[];
}

export function GroupChatInput({ onSend, onCameraPress, members }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const [sending, setSending] = useState(false);

  const replyTarget = useReplyStore((s) => s.target);
  const clearReply = useReplyStore((s) => s.clear);

  const prefix = activeMentionPrefix(text, selection.start);

  const suggestions = useMemo(() => {
    if (prefix === null) return [] as MentionMember[];
    const lower = prefix.toLowerCase();
    return members
      .filter(
        (m) =>
          m.username.toLowerCase().startsWith(lower) ||
          m.display_name.toLowerCase().startsWith(lower)
      )
      .slice(0, 6);
  }, [prefix, members]);

  function applyMention(member: MentionMember) {
    if (prefix === null) return;
    const start = selection.start;
    const beforeAt = text.lastIndexOf('@', start - 1);
    if (beforeAt === -1) return;
    const before = text.slice(0, beforeAt);
    const after = text.slice(start);
    const insertion = `@${member.username} `;
    const next = `${before}${insertion}${after}`;
    setText(next);
    const newCaret = before.length + insertion.length;
    setSelection({ start: newCaret, end: newCaret });
    setTimeout(() => inputRef.current?.setNativeProps({ selection: { start: newCaret, end: newCaret } }), 0);
  }

  async function handleSend() {
    if (!text.trim() || sending) return;
    const message = text.trim();
    const mentionIds = parseMentions(message, members);
    const replyId = replyTarget?.messageId ?? null;
    setText('');
    setSending(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await onSend(message, mentionIds, replyId);
      clearReply();
    } finally {
      setSending(false);
    }
  }

  function handleSelectionChange(
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>
  ) {
    setSelection(e.nativeEvent.selection);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      {suggestions.length > 0 && (
        <View
          className="border-t"
          style={{ backgroundColor: c.surface, borderColor: c.divider }}>
          <FlatList
            data={suggestions}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => applyMention(item)}
                className="flex-row items-center px-4 py-2"
                android_ripple={{ color: c.rowPress }}>
                <Avatar uri={null} name={item.display_name} size={28} />
                <View className="ml-3 flex-1">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: c.textPrimary }}
                    numberOfLines={1}>
                    {item.display_name}
                  </Text>
                  <Text className="text-xs" style={{ color: c.textSecondary }}>
                    @{item.username}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}

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
          ref={inputRef}
          className="flex-1 rounded-full px-4 py-2 text-base"
          style={{ backgroundColor: c.inputBg, color: c.textPrimary }}
          placeholder={
            replyTarget
              ? t('chat.group.input.replyPlaceholder', { name: replyTarget.authorName })
              : t('chat.group.input.sendPlaceholder')
          }
          placeholderTextColor={c.placeholder}
          value={text}
          onChangeText={setText}
          onSelectionChange={handleSelectionChange}
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
