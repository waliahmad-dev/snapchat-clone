import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import { Avatar } from '@components/ui/Avatar';
import { ensureConversation } from '@features/chat/utils/conversation';
import { useThemeColors } from '@lib/theme/useThemeColors';
import type {
  DbMessage,
  DbUser,
  DbConversation,
  DbGroupMessage,
  GroupNotificationsSetting,
} from '@/types/database';

const SCREEN_W = Dimensions.get('window').width;
const DURATION = 3600;

interface ToastPayload {
  id: string;
  title: string;
  body: string;
  avatarUrl: string | null;
  accent: 'snap' | 'message' | 'system';
  onPress?: () => void;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const c = useThemeColors();
  const profile = useAuthStore((s) => s.profile);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const [toast, setToast] = useState<ToastPayload | null>(null);
  const translateY = useSharedValue(-120);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    translateY.value = withTiming(
      -120,
      { duration: 220, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setToast)(null);
      },
    );
  };

  function showToast(payload: ToastPayload) {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast(payload);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    translateY.value = withTiming(0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
    hideTimer.current = setTimeout(hide, DURATION);
  }

  const toastStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as DbMessage;

          if (msg.sender_id === profile.id) return;
          if (msg.type === 'system') return;

          const currentPath = pathnameRef.current;
          if (currentPath.includes(`/chat/${msg.conversation_id}`)) return;

          const { data: sender } = await supabase
            .from('users')
            .select('id, display_name, username, avatar_url')
            .eq('id', msg.sender_id)
            .maybeSingle();

          if (!sender) return;

          showToast({
            id: msg.id,
            title: (sender as DbUser).display_name,
            body:
              msg.type === 'snap'
                ? '📸 Sent you a Snap'
                : `💬 ${msg.content ?? 'Sent you a message'}`,
            avatarUrl: (sender as DbUser).avatar_url,
            accent: msg.type === 'snap' ? 'snap' : 'message',
            onPress: async () => {
              hide();
              const convId =
                msg.conversation_id ??
                (await ensureConversation(profile.id, (sender as DbUser).id));
              if (!convId) return;
              router.push({
                pathname: '/(app)/chat/[conversationId]',
                params: {
                  conversationId: convId,
                  friendId: (sender as DbUser).id,
                  friendName: (sender as DbUser).display_name,
                },
              });
            },
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        async (payload) => {
          const msg = payload.new as DbGroupMessage;

          if (msg.sender_id === profile.id) return;
          if (msg.type === 'system') return;

          const currentPath = pathnameRef.current;
          if (currentPath.includes(`/chat/group/${msg.group_id}`)) return;

          // Only notify if I'm an active member of this group.
          const { data: myMembership } = await supabase
            .from('group_members')
            .select('notifications, left_at')
            .eq('group_id', msg.group_id)
            .eq('user_id', profile.id)
            .is('left_at', null)
            .maybeSingle();
          if (!myMembership) return;

          const setting =
            (myMembership as { notifications: GroupNotificationsSetting })
              .notifications ?? 'all';
          const iAmMentioned = (msg.mentions ?? []).includes(profile.id);
          if (setting === 'none' && !iAmMentioned) return;
          if (setting === 'mentions' && !iAmMentioned) return;

          const [{ data: sender }, { data: group }] = await Promise.all([
            supabase
              .from('users')
              .select('id, display_name, username, avatar_url')
              .eq('id', msg.sender_id)
              .maybeSingle(),
            supabase
              .from('group_chats')
              .select('id, name')
              .eq('id', msg.group_id)
              .maybeSingle(),
          ]);
          if (!sender) return;

          const senderUser = sender as DbUser;
          const groupName =
            (group as { name?: string | null } | null)?.name?.trim() ||
            senderUser.display_name;
          const previewBody =
            msg.type === 'media'
              ? `📷 ${senderUser.display_name} sent a snap`
              : iAmMentioned
                ? `🏷️ ${senderUser.display_name} mentioned you`
                : `💬 ${senderUser.display_name}: ${msg.content ?? ''}`;

          showToast({
            id: msg.id,
            title: groupName,
            body: previewBody,
            avatarUrl: senderUser.avatar_url,
            accent: msg.type === 'media' ? 'snap' : 'message',
            onPress: () => {
              hide();
              router.push({
                pathname: '/(app)/chat/group/[groupId]',
                params: { groupId: msg.group_id, name: groupName },
              });
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.wrapper, toastStyle]}>
          <SafeAreaView edges={['top']}>
            <Pressable
              onPress={() => toast.onPress?.()}
              style={[styles.card, { backgroundColor: c.surfaceElevated }]}
              android_ripple={{ color: c.rowPress }}>
              <Avatar uri={toast.avatarUrl} name={toast.title} size={40} />
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text
                  className="font-bold text-sm"
                  style={{ color: c.textPrimary }}
                  numberOfLines={1}>
                  {toast.title}
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: c.textSecondary }}
                  numberOfLines={1}>
                  {toast.body}
                </Text>
              </View>
              <View
                style={[
                  styles.accentDot,
                  {
                    backgroundColor:
                      toast.accent === 'snap' ? '#FF3B30' : '#00C2FF',
                  },
                ]}>
                <Ionicons
                  name={toast.accent === 'snap' ? 'camera' : 'chatbubble'}
                  size={12}
                  color="#fff"
                />
              </View>
            </Pressable>
          </SafeAreaView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  card: {
    marginHorizontal: 12,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    width: SCREEN_W - 24,
  },
  accentDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
