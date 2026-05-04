import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@components/ui/Avatar';
import { SystemEventBubble } from '@features/chat/components/SystemEventBubble';
import { SnapViewer } from '@features/chat/components/SnapViewer';
import { useReplyStore } from '@features/chat/store/replyStore';
import { getSignedUrl } from '@lib/supabase/storage';
import { supabase } from '@lib/supabase/client';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';
import { MentionText } from './MentionText';
import type { DbGroupMessage, DbMessage } from '@/types/database';
import type { MentionMember } from '../utils/mentions';

interface Props {
  message: DbGroupMessage;
  isOwn: boolean;
  authorName: string;
  authorAvatar: string | null;
  members: MentionMember[];
  showAuthor: boolean;
  iAmMentioned: boolean;
  viewedByMe: boolean;
  onMarkViewed: (id: string) => void;
  onSetSaved: (id: string, save: boolean) => void;
  onDelete: (id: string) => void;
  onPostSystem: (content: string) => void;
}

function thumbPathFromFull(path: string): string {
  return path.replace(/_full\.(jpe?g|png)$/i, '_thumb.$1');
}

export function GroupMessageBubble(props: Props) {
  const { message } = props;
  if (message.type === 'system') {
    return (
      <SystemEventBubble
        message={
          {
            id: message.id,
            content: message.content,
            created_at: message.created_at,
          } as DbMessage
        }
      />
    );
  }
  if (message.deleted_at) return null;
  if (message.type === 'media') return <MediaBubble {...props} />;
  return <TextBubble {...props} />;
}

function AuthorHeader({ name, avatar }: { name: string; avatar: string | null }) {
  const c = useThemeColors();
  return (
    <View className="flex-row items-center mb-1 ml-1">
      <Avatar uri={avatar} name={name} size={20} />
      <Text className="ml-2 text-xs font-semibold" style={{ color: c.textSecondary }}>
        {name}
      </Text>
    </View>
  );
}

function TextBubble({
  message,
  isOwn,
  authorName,
  authorAvatar,
  members,
  showAuthor,
  iAmMentioned,
  onSetSaved,
  onDelete,
  onPostSystem,
}: Props) {
  const c = useThemeColors();
  const isSaved = message.saved_by.length > 0;
  const setReplyTarget = useReplyStore((s) => s.setTarget);
  const [quoted, setQuoted] = useState<DbGroupMessage | null>(null);

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
          .from('group_messages')
          .select('*')
          .eq('id', replyId)
          .maybeSingle();
        if (!cancelled) setQuoted(data as DbGroupMessage | null);
      } catch {
        // offline
      }
    })();
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

  function startReply() {
    setReplyTarget({
      messageId: message.id,
      preview: (message.content ?? '').slice(0, 80) || 'Message',
      authorName,
      isSnap: false,
    });
  }

  function handleLongPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOwn) {
      Alert.alert('Delete message?', 'Members will see it was deleted.', [
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
        { text: 'Reply', onPress: startReply },
      ]);
    }
  }

  const colors = bubbleColors(c, isOwn);

  return (
    <View className={`flex-col ${isOwn ? 'items-end' : 'items-start'} my-1 px-4`}>
      {!isOwn && showAuthor && <AuthorHeader name={authorName} avatar={authorAvatar} />}
      {iAmMentioned && !isOwn && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: c.accent,
            alignSelf: 'flex-start',
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 2,
            marginBottom: 4,
            marginLeft: 4,
          }}>
          <Ionicons name="at" size={11} color={c.accentText} />
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: c.accentText,
              marginLeft: 2,
              letterSpacing: 0.5,
            }}>
            MENTIONED YOU
          </Text>
        </View>
      )}
      <Pressable
        onPress={toggleSave}
        onLongPress={handleLongPress}
        delayLongPress={350}>
        <View
          style={[
            styles.textBubble,
            { backgroundColor: colors.bg },
            isSaved && {
              borderWidth: 2,
              borderColor: c.accent,
            },
            iAmMentioned &&
              !isOwn && {
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
                {quoted.type === 'media' ? '📷 Snap' : 'Replying to'}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: isOwn ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
                }}
                numberOfLines={2}>
                {quoted.content ?? (quoted.type === 'media' ? 'Snap' : 'Message')}
              </Text>
            </View>
          )}
          <MentionText
            content={message.content ?? ''}
            members={members}
            baseColor={colors.text}
          />
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
          style={{
            color: c.textMuted,
            fontSize: 10,
            marginTop: 4,
            textAlign: isOwn ? 'right' : 'left',
          }}>
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </Text>
      </Pressable>
    </View>
  );
}

function MediaBubble({
  message,
  isOwn,
  authorName,
  authorAvatar,
  showAuthor,
  viewedByMe,
  onMarkViewed,
  onSetSaved,
  onDelete,
  onPostSystem,
}: Props) {
  const c = useThemeColors();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [signedFull, setSignedFull] = useState<string | null>(null);
  const [signedThumb, setSignedThumb] = useState<string | null>(null);

  const isSavedAnywhere = message.saved_by.length > 0;

  useEffect(() => {
    if (!message.media_url) return;
    let cancelled = false;
    (async () => {
      try {
        const full = await getSignedUrl('snaps', message.media_url!);
        if (!cancelled) setSignedFull(full);
      } catch {
        // offline
      }
      if (isSavedAnywhere) {
        try {
          const thumb = await getSignedUrl(
            'snaps',
            thumbPathFromFull(message.media_url!)
          );
          if (!cancelled) setSignedThumb(thumb);
        } catch {
          // offline
        }
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
    if (viewedByMe) return false;
    return true;
  }

  function openSnap() {
    if (!canOpen()) return;
    setViewerOpen(true);
  }

  // Mark viewed on CLOSE, not on open. Marking on open would record this
  // user's view immediately, and (in a 2-person group) trigger the
  // "everyone has seen it" branch of the visibility filter — which would
  // unmount the bubble + viewer mid-watch.
  function closeSnap(_savedInSession: boolean) {
    setViewerOpen(false);
    if (!isOwn && !viewedByMe) onMarkViewed(message.id);
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
      Alert.alert('Delete snap?', 'Members will see that you deleted it.', [
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
    }
  }

  if (isSavedAnywhere) {
    const previewUri = signedThumb ?? signedFull;
    return (
      <View className={`flex-col ${isOwn ? 'items-end' : 'items-start'} px-4`}>
        {!isOwn && showAuthor && <AuthorHeader name={authorName} avatar={authorAvatar} />}
        <Pressable
          onPress={openSnap}
          onLongPress={handleLongPress}
          delayLongPress={350}
          className="my-1.5 rounded-2xl overflow-hidden"
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
          <View style={[styles.savedBadge, { backgroundColor: c.accent }]}>
            <Ionicons name="bookmark" size={12} color={c.accentText} />
            <Text
              style={{
                color: c.accentText,
                fontWeight: '700',
                fontSize: 10,
                marginLeft: 4,
              }}>
              SAVED
            </Text>
          </View>
        </Pressable>

        {viewerOpen && message.media_url && (
          <SnapViewer
            mediaPath={message.media_url}
            preloadedUrl={signedFull}
            isOwn={isOwn}
            alreadySaved
            onClose={closeSnap}
            onSave={saveInViewer}
            onUnsave={unsaveInViewer}
          />
        )}
      </View>
    );
  }

  const bannerStyle = isOwn
    ? { backgroundColor: '#B14CFF' }
    : viewedByMe
      ? { backgroundColor: '#3A3A3D' }
      : { backgroundColor: '#FF3B30' };
  const label = isOwn
    ? 'Sent · Tap to view'
    : viewedByMe
      ? 'Opened'
      : 'New Snap — Tap to open';

  return (
    <View className={`flex-col ${isOwn ? 'items-end' : 'items-start'} px-3`}>
      {!isOwn && showAuthor && <AuthorHeader name={authorName} avatar={authorAvatar} />}
      <Pressable
        onPress={openSnap}
        onLongPress={handleLongPress}
        delayLongPress={350}
        style={styles.bannerWrap}>
        <View style={[styles.banner, bannerStyle]}>
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
          alreadySaved={false}
          onClose={closeSnap}
          onSave={saveInViewer}
          onUnsave={unsaveInViewer}
        />
      )}
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
    marginHorizontal: 8,
    marginVertical: 3,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 10,
    minWidth: 220,
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
