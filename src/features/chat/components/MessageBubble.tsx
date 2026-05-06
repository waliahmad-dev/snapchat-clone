import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, Alert, StyleSheet } from 'react-native';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { DbMessage } from '@/types/database';
import { supabase } from '@lib/supabase/client';
import { getSignedUrl } from '@lib/supabase/storage';
import { useAuthStore } from '@features/auth/store/authStore';
import { encodeSystemEvent } from '@lib/i18n/systemEvent';
import { SystemEventBubble } from './SystemEventBubble';
import { SnapViewer } from './SnapViewer';
import { SwipeToReply } from './SwipeToReply';
import { useReplyStore } from '../store/replyStore';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';

// Per-user save: a message persists as long as cardinality(saved_by) > 0.
// Tap behavior depends on whether the *current* user has it saved.
function savedByLabel(
  savedBy: string[],
  myId: string | undefined,
  t: (key: string) => string,
): string {
  if (savedBy.length === 0) return '';
  const byMe = !!myId && savedBy.includes(myId);
  if (savedBy.length === 1) return byMe ? t('chat.savedByYou') : t('chat.savedBadge');
  // 1:1 chat tops out at 2 participants → "by both".
  return t('chat.savedByBoth');
}

interface Props {
  message: DbMessage;
  isOwn: boolean;
  authorName: string;
  onMarkViewed: (id: string) => void;
  onSetSaved: (id: string, save: boolean) => void;
  onDelete: (id: string) => void;
  onPostSystem: (content: string) => void;
}

function thumbPathFromFull(path: string): string {
  return path.replace(/_full\.(jpe?g|png)$/i, '_thumb.$1');
}

function MessageBubbleInner(props: Props) {
  const { message } = props;
  if (message.type === 'system') return <SystemEventBubble message={message} />;
  if (message.deleted_at) return null;
  if (message.type === 'snap') return <SnapBubble {...props} />;
  return <TextBubble {...props} />;
}

export const MessageBubble = React.memo(MessageBubbleInner, (prev, next) => {
  const a = prev.message;
  const b = next.message;
  if (
    a.id !== b.id ||
    a.content !== b.content ||
    a.media_url !== b.media_url ||
    a.viewed_at !== b.viewed_at ||
    a.deleted_at !== b.deleted_at ||
    a.reply_to_message_id !== b.reply_to_message_id ||
    prev.isOwn !== next.isOwn ||
    prev.authorName !== next.authorName
  ) {
    return false;
  }
  if (a.saved_by.length !== b.saved_by.length) return false;
  for (let i = 0; i < a.saved_by.length; i++) {
    if (a.saved_by[i] !== b.saved_by[i]) return false;
  }
  return true;
});

function SnapBubble({
  message,
  isOwn,
  authorName,
  onMarkViewed,
  onSetSaved,
  onDelete,
  onPostSystem,
}: Props) {
  const c = useThemeColors();
  const { t } = useTranslation();
  const myId = useAuthStore((s) => s.profile?.id);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [signedFull, setSignedFull] = useState<string | null>(null);
  const [signedThumb, setSignedThumb] = useState<string | null>(null);
  const setReplyTarget = useReplyStore((s) => s.setTarget);

  const alreadyViewed = !!message.viewed_at;
  const isSavedAnywhere = message.saved_by.length > 0;
  const isSavedByMe = !!myId && message.saved_by.includes(myId);

  useEffect(() => {
    if (!message.media_url) return;
    let cancelled = false;

    (async () => {
      try {
        const full = await getSignedUrl('snaps', message.media_url!);
        if (!cancelled) setSignedFull(full);
      } catch {}

      if (isSavedAnywhere) {
        try {
          const thumb = await getSignedUrl('snaps', thumbPathFromFull(message.media_url!));
          if (!cancelled) setSignedThumb(thumb);
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [message.media_url, isSavedAnywhere]);

  function canOpen(): boolean {
    if (!message.media_url) return false;
    if (isSavedAnywhere) return true;
    if (isOwn) return false;
    if (alreadyViewed) return false;
    return true;
  }

  function openSnap() {
    if (!canOpen()) return;
    setViewerOpen(true);
    if (!alreadyViewed && !isOwn) onMarkViewed(message.id);
  }

  // Auto-soft-delete only when no participant has the snap saved. If the
  // other user still has it saved (or the current user has but the session
  // didn't add a new save), the row stays.
  function closeSnap(savedInSession: boolean) {
    setViewerOpen(false);
    const stillSaved = isSavedAnywhere || savedInSession;
    if (!stillSaved && !isOwn) onDelete(message.id);
  }

  function saveInViewer() {
    onSetSaved(message.id, true);
    onPostSystem(encodeSystemEvent('chat.savedSnap', { name: authorName }));
  }

  function unsaveInViewer() {
    onSetSaved(message.id, false);
    onPostSystem(encodeSystemEvent('chat.unsavedSnap', { name: authorName }));
  }

  function startReply() {
    setReplyTarget({
      messageId: message.id,
      preview: '📸 Snap',
      authorName,
      isSnap: true,
    });
  }

  function handleLongPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOwn) {
      Alert.alert(t('chat.deleteSnapTitle'), t('chat.deleteSnapBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            onDelete(message.id);
            onPostSystem(
              encodeSystemEvent('chat.group.bubble.deletedSnap', { name: authorName }),
            );
          },
        },
      ]);
    } else {
      Alert.alert(t('chat.replyToSnapTitle'), '', [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.reply'), onPress: startReply },
      ]);
    }
  }

  if (isSavedAnywhere) {
    const previewUri = signedThumb ?? signedFull;
    const badgeText = savedByLabel(message.saved_by, myId, t);
    return (
      <>
        <SwipeToReply isOwn={isOwn} onTriggerReply={startReply}>
          <View className={`flex-row ${isOwn ? 'justify-end' : 'justify-start'} px-4`}>
            <Pressable
              onPress={openSnap}
              onLongPress={handleLongPress}
              delayLongPress={350}
              className="my-1.5 overflow-hidden rounded-2xl"
              style={styles.savedPreview}>
              {previewUri ? (
                <Image
                  source={{ uri: previewUri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.previewImage, styles.previewPlaceholder]} />
              )}
              <View
                style={[
                  styles.savedBadge,
                  { backgroundColor: isSavedByMe ? c.accent : 'rgba(0,0,0,0.55)' },
                ]}>
                <Ionicons
                  name="bookmark"
                  size={12}
                  color={isSavedByMe ? c.accentText : '#FFFFFF'}
                />
                <Text
                  style={{
                    color: isSavedByMe ? c.accentText : '#FFFFFF',
                    fontWeight: '700',
                    fontSize: 10,
                    marginLeft: 4,
                  }}>
                  {badgeText}
                </Text>
              </View>
            </Pressable>
          </View>
        </SwipeToReply>

        {viewerOpen && message.media_url && (
          <SnapViewer
            mediaPath={message.media_url}
            preloadedUrl={signedFull}
            isOwn={isOwn}
            alreadySaved={isSavedByMe}
            onClose={closeSnap}
            onSave={saveInViewer}
            onUnsave={unsaveInViewer}
          />
        )}
      </>
    );
  }

  const canTap = canOpen();
  const bannerStyle = isOwn ? { backgroundColor: '#B14CFF' } : { backgroundColor: '#FF3B30' };
  const label = isOwn
    ? alreadyViewed
      ? t('chat.row.opened')
      : t('chat.row.delivered')
    : alreadyViewed
      ? t('chat.row.opened')
      : t('chat.snap.newSnap');

  return (
    <>
      <SwipeToReply isOwn={isOwn} onTriggerReply={startReply}>
        <Pressable
          onPress={openSnap}
          onLongPress={handleLongPress}
          delayLongPress={350}
          disabled={!canTap && !isOwn}
          style={styles.bannerWrap}>
          <View style={[styles.banner, bannerStyle, !canTap && { opacity: 0.75 }]}>
            <View style={styles.squareIndicator}>
              <Ionicons name="play" size={12} color="#FFFFFF" />
            </View>
            <Text
              style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16, flex: 1 }}
              numberOfLines={1}>
              {label}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
          </View>
        </Pressable>
      </SwipeToReply>

      {viewerOpen && message.media_url && (
        <SnapViewer
          mediaPath={message.media_url}
          preloadedUrl={signedFull}
          isOwn={isOwn}
          alreadySaved={isSavedByMe}
          onClose={closeSnap}
          onSave={saveInViewer}
          onUnsave={unsaveInViewer}
        />
      )}
    </>
  );
}

function TextBubble({ message, isOwn, authorName, onSetSaved, onDelete, onPostSystem }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation();
  const myId = useAuthStore((s) => s.profile?.id);
  const isSavedAnywhere = message.saved_by.length > 0;
  const isSavedByMe = !!myId && message.saved_by.includes(myId);
  const setReplyTarget = useReplyStore((s) => s.setTarget);
  const [quoted, setQuoted] = useState<DbMessage | null>(null);

  useEffect(() => {
    const replyId = message.reply_to_message_id;
    if (!replyId) {
      setQuoted(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('id', replyId)
          .maybeSingle();
        if (!cancelled) setQuoted(data as DbMessage | null);
      } catch {
        // offline — quote preview will populate when reconnected
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [message.reply_to_message_id]);

  // Per-user toggle: only my own entry in saved_by[] flips. If the other
  // user has it saved, my "unsave" just removes me — the message stays
  // visible and persistent. Tapping when I haven't saved (regardless of
  // whether the other user has) saves it for me, matching the spec's
  // "treat unsave-without-prior-save as save" rule.
  function toggleSave() {
    Haptics.selectionAsync();
    if (isSavedByMe) {
      onSetSaved(message.id, false);
      onPostSystem(encodeSystemEvent('chat.unsavedMessage', { name: authorName }));
    } else {
      onSetSaved(message.id, true);
      onPostSystem(encodeSystemEvent('chat.savedMessage', { name: authorName }));
    }
  }

  function startReply() {
    setReplyTarget({
      messageId: message.id,
      preview: (message.content ?? '').slice(0, 80) || t('common.message'),
      authorName,
      isSnap: false,
    });
  }

  function handleLongPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOwn) {
      Alert.alert(t('chat.deleteMessageTitle'), t('chat.deleteMessageBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            onDelete(message.id);
            onPostSystem(encodeSystemEvent('chat.unsavedMessage', { name: authorName }));
          },
        },
      ]);
    } else {
      Alert.alert(t('chat.replyToMessageTitle'), '', [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.reply'), onPress: startReply },
      ]);
    }
  }

  const bubbleStyle = bubbleColors(c, isOwn);

  return (
    <SwipeToReply isOwn={isOwn} onTriggerReply={startReply}>
      <View className={`flex-row ${isOwn ? 'justify-end' : 'justify-start'} my-1 px-4`}>
        <Pressable onPress={toggleSave} onLongPress={handleLongPress} delayLongPress={350}>
          <View
            style={[
              styles.textBubble,
              { backgroundColor: bubbleStyle.bg },
              // Glow only when *I* have it saved — gives a per-user visual
              // anchor while still keeping the badge visible whenever any
              // participant has saved.
              isSavedByMe && {
                borderWidth: 2,
                borderColor: c.accent,
                shadowColor: c.accent,
                shadowOpacity: 0.6,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              },
              isSavedAnywhere &&
                !isSavedByMe && {
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.45)',
                },
            ]}>
            {quoted && (
              <View
                style={[
                  styles.quoteBlock,
                  {
                    borderLeftColor: isOwn ? 'rgba(0,0,0,0.35)' : 'rgba(255,252,0,0.8)',
                  },
                ]}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: isOwn ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
                  }}>
                  {quoted.type === 'snap'
                    ? t('chat.preview.snap')
                    : t('chat.conversation.replyingTo', { name: authorName })}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isOwn ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
                  }}
                  numberOfLines={2}>
                  {quoted.content ?? (quoted.type === 'snap' ? t('chat.preview.snap') : '')}
                </Text>
              </View>
            )}
            <Text style={{ color: bubbleStyle.text }}>{message.content}</Text>
            {isSavedAnywhere && (
              <View
                style={[
                  styles.savedIndicator,
                  {
                    backgroundColor: isSavedByMe ? c.accent : 'rgba(0,0,0,0.45)',
                  },
                ]}>
                <Ionicons
                  name="bookmark"
                  size={10}
                  color={isSavedByMe ? c.accentText : '#FFFFFF'}
                />
                <Text
                  style={{
                    color: isSavedByMe ? c.accentText : '#FFFFFF',
                    fontSize: 10,
                    fontWeight: '700',
                    marginLeft: 4,
                  }}>
                  {savedByLabel(message.saved_by, myId, t)}
                </Text>
              </View>
            )}
          </View>
          <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 4, textAlign: 'right' }}>
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </Text>
        </Pressable>
      </View>
    </SwipeToReply>
  );
}

function bubbleColors(c: ThemeColors, isOwn: boolean) {
  return isOwn
    ? { bg: c.bubbleSelf, text: c.bubbleSelfText }
    : { bg: c.bubbleOther, text: c.bubbleOtherText };
}

const styles = StyleSheet.create({
  bannerWrap: {
    marginHorizontal: 12,
    marginVertical: 3,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 10,
  },
  squareIndicator: {
    width: 20,
    height: 20,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedPreview: {
    width: 180,
    height: (180 * 16) / 9,
    borderRadius: 14,
    backgroundColor: '#000',
  },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: { backgroundColor: '#1A1A1A' },
  savedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  textBubble: {
    maxWidth: 260,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  savedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    alignSelf: 'flex-end',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  quoteBlock: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
});
