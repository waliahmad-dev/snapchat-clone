import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, Alert, StyleSheet } from 'react-native';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { DbMessage } from '@/types/database';
import { supabase } from '@lib/supabase/client';
import { getSignedUrl } from '@lib/supabase/storage';
import { SystemEventBubble } from './SystemEventBubble';
import { SnapViewer } from './SnapViewer';
import { useReplyStore } from '../store/replyStore';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';

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

export function MessageBubble(props: Props) {
  const { message } = props;
  if (message.type === 'system') return <SystemEventBubble message={message} />;
  if (message.deleted_at) return null;
  if (message.type === 'snap') return <SnapBubble {...props} />;
  return <TextBubble {...props} />;
}

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
  const [viewerOpen, setViewerOpen] = useState(false);
  const [signedFull, setSignedFull] = useState<string | null>(null);
  const [signedThumb, setSignedThumb] = useState<string | null>(null);
  const setReplyTarget = useReplyStore((s) => s.setTarget);

  const alreadyViewed = !!message.viewed_at;
  const isSaved = !!message.saved;

  useEffect(() => {
    if (!message.media_url) return;
    let cancelled = false;

    (async () => {
      try {
        const full = await getSignedUrl('snaps', message.media_url!);
        if (!cancelled) setSignedFull(full);
      } catch {
      }

      if (isSaved) {
        try {
          const thumb = await getSignedUrl(
            'snaps',
            thumbPathFromFull(message.media_url!),
          );
          if (!cancelled) setSignedThumb(thumb);
        } catch {
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [message.media_url, isSaved]);

  function canOpen(): boolean {
    if (!message.media_url) return false;
    if (isSaved) return true;
    if (isOwn) return false;
    if (alreadyViewed) return false;
    return true;
  }

  function openSnap() {
    if (!canOpen()) return;
    setViewerOpen(true);
    if (!alreadyViewed && !isOwn) onMarkViewed(message.id);
  }

  function closeSnap(savedInSession: boolean) {
    setViewerOpen(false);
    const isSavedNow = isSaved || savedInSession;
    if (!isSavedNow && !isOwn) onDelete(message.id);
  }

  function saveInViewer() {
    onSetSaved(message.id, true);
    onPostSystem(`${authorName} saved a snap`);
  }

  function unsaveInViewer() {
    onSetSaved(message.id, false);
    onPostSystem(`${authorName} unsaved a snap`);
  }

  function handleLongPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOwn) {
      Alert.alert('Delete snap?', 'Both of you will see that you deleted it.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(message.id);
            onPostSystem(`${authorName} deleted a snap`);
          },
        },
      ]);
    } else {
      Alert.alert('Reply to snap?', '', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reply',
          onPress: () =>
            setReplyTarget({
              messageId: message.id,
              preview: '📸 Snap',
              authorName,
              isSnap: true,
            }),
        },
      ]);
    }
  }

  if (isSaved) {
    const previewUri = signedThumb ?? signedFull;
    return (
      <>
        <Pressable
          onPress={openSnap}
          onLongPress={handleLongPress}
          delayLongPress={350}
          className={`mx-4 my-1.5 rounded-2xl overflow-hidden ${isOwn ? 'self-end' : 'self-start'}`}
          style={styles.savedPreview}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={[styles.previewImage, styles.previewPlaceholder]} />
          )}
          <View style={[styles.savedBadge, { backgroundColor: c.accent }]}>
            <Ionicons name="bookmark" size={12} color={c.accentText} />
            <Text style={{ color: c.accentText, fontWeight: '700', fontSize: 10, marginLeft: 4 }}>
              SAVED
            </Text>
          </View>
        </Pressable>

        {viewerOpen && message.media_url && (
          <SnapViewer
            mediaPath={message.media_url}
            preloadedUrl={signedFull}
            isOwn={isOwn}
            alreadySaved={isSaved}
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
    ? alreadyViewed ? 'Opened' : 'Delivered'
    : alreadyViewed ? 'Opened' : 'New Snap — Tap to open';

  return (
    <>
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

      {viewerOpen && message.media_url && (
        <SnapViewer
          mediaPath={message.media_url}
          preloadedUrl={signedFull}
          isOwn={isOwn}
          alreadySaved={isSaved}
          onClose={closeSnap}
          onSave={saveInViewer}
          onUnsave={unsaveInViewer}
        />
      )}
    </>
  );
}

function TextBubble({
  message,
  isOwn,
  authorName,
  onSetSaved,
  onDelete,
  onPostSystem,
}: Props) {
  const c = useThemeColors();
  const isSaved = !!message.saved;
  const setReplyTarget = useReplyStore((s) => s.setTarget);
  const [quoted, setQuoted] = useState<DbMessage | null>(null);

  useEffect(() => {
    const replyId = message.reply_to_message_id;
    if (!replyId) {
      setQuoted(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('messages')
      .select('*')
      .eq('id', replyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setQuoted(data as DbMessage | null);
      });
    return () => {
      cancelled = true;
    };
  }, [message.reply_to_message_id]);

  function toggleSave() {
    Haptics.selectionAsync();
    if (isSaved) {
      onSetSaved(message.id, false);
      onPostSystem(`${authorName} unsaved a message`);
    } else {
      onSetSaved(message.id, true);
      onPostSystem(`${authorName} saved a message`);
    }
  }

  function handleLongPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOwn) {
      Alert.alert('Delete message?', 'Both of you will see it was deleted.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(message.id);
            onPostSystem(`${authorName} deleted a message`);
          },
        },
      ]);
    } else {
      Alert.alert('Reply to this message?', '', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reply',
          onPress: () =>
            setReplyTarget({
              messageId: message.id,
              preview: (message.content ?? '').slice(0, 80) || 'Message',
              authorName,
              isSnap: false,
            }),
        },
      ]);
    }
  }

  const bubbleStyle = bubbleColors(c, isOwn);

  return (
    <View className={`flex-row ${isOwn ? 'justify-end' : 'justify-start'} my-1 px-4`}>
      <Pressable
        onPress={toggleSave}
        onLongPress={handleLongPress}
        delayLongPress={350}>
        <View
          style={[
            styles.textBubble,
            { backgroundColor: bubbleStyle.bg },
            isSaved && {
              borderWidth: 2,
              borderColor: c.accent,
              shadowColor: c.accent,
              shadowOpacity: 0.6,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}>
          {quoted && (
            <View
              style={[
                styles.quoteBlock,
                {
                  borderLeftColor: isOwn
                    ? 'rgba(0,0,0,0.35)'
                    : 'rgba(255,252,0,0.8)',
                },
              ]}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: isOwn ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
                }}>
                {quoted.type === 'snap' ? '📸 Snap' : 'Replying to'}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: isOwn ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
                }}
                numberOfLines={2}>
                {quoted.content ?? (quoted.type === 'snap' ? 'Snap' : 'Message')}
              </Text>
            </View>
          )}
          <Text style={{ color: bubbleStyle.text }}>{message.content}</Text>
          {isSaved && (
            <View style={[styles.savedIndicator, { backgroundColor: c.accent }]}>
              <Ionicons name="bookmark" size={10} color={c.accentText} />
              <Text
                style={{
                  color: c.accentText,
                  fontSize: 10,
                  fontWeight: '700',
                  marginLeft: 4,
                }}>
                SAVED
              </Text>
            </View>
          )}
        </View>
        <Text
          style={{ color: c.textMuted, fontSize: 10, marginTop: 4, textAlign: 'right' }}>
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </Text>
      </Pressable>
    </View>
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
