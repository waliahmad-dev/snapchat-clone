import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useProfile } from '@features/profile/hooks/useProfile';
import { useFriendRequest } from '@features/friends/hooks/useFriendRequest';
import { Avatar } from '@components/ui/Avatar';
import { useAuthStore } from '@features/auth/store/authStore';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';
import { formatBirthday, zodiacFromIso } from '@features/profile/utils/horoscope';

const HERO_BG_URL = 'https://picsum.photos/seed/snapclone-profile-bg/1080/1440';

export default function UserProfileScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const styles = useStyles(c);
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { profile, loading, notFound } = useProfile(userId);
  const currentUser = useAuthStore((s) => s.profile);
  const {
    sendRequest,
    acceptRequest,
    declineRequest,
    unfriendAndPurge,
    blockUser,
    getFriendshipStatus,
  } = useFriendRequest();
  const [actionLoading, setActionLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [iSentRequest, setISentRequest] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    if (!currentUser || !userId) return;
    let cancelled = false;
    setStatusLoaded(false);
    getFriendshipStatus(userId).then(({ status, friendshipId: fid, iSentRequest: mine }) => {
      if (cancelled) return;
      setFriendshipStatus(status);
      setFriendshipId(fid);
      setISentRequest(mine);
      setStatusLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, currentUser?.id]);

  async function handleAdd() {
    setActionLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sendRequest(userId);
      setSent(true);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAccept() {
    if (!friendshipId) return;
    setActionLoading(true);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await acceptRequest(friendshipId);
      setFriendshipStatus('accepted');
    } catch (err: any) {
      Alert.alert('Could not accept', err.message ?? 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDecline() {
    if (!friendshipId) return;
    setActionLoading(true);
    try {
      await declineRequest(friendshipId);
      setFriendshipStatus(null);
      setFriendshipId(null);
      setISentRequest(false);
      router.back();
    } catch (err: any) {
      Alert.alert('Could not decline', err.message ?? 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleUnfriend() {
    if (!profile || !friendshipId) return;
    const handle = profile.username ? `@${profile.username}` : profile.display_name;
    Alert.alert(
      `Unfriend ${handle}?`,
      'All of your messages, snaps, and shared media will be cleared. They can still find you in search.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await unfriendAndPurge(friendshipId, userId);
              setFriendshipStatus(null);
              setFriendshipId(null);
              router.back();
            } catch (err: any) {
              Alert.alert('Could not unfriend', err.message ?? 'Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }

  function handleBlock() {
    if (!profile || !currentUser) return;
    const handle = profile.username ? `@${profile.username}` : profile.display_name;
    Alert.alert(
      `Block ${handle}?`,
      'Your friendship will end and all messages, snaps, shared media, and your streak will be cleared. Neither of you will be able to find or contact each other until you unblock.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await blockUser(friendshipId, userId);

              router.replace('/(app)/chat');
            } catch (err: any) {
              Alert.alert('Could not block', err.message ?? 'Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }

  if (notFound) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
          <View style={styles.plainHeader}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
              <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
            </Pressable>
            <View style={styles.headerBtn} />
          </View>
        </SafeAreaView>
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: c.iconCircleBg }]}>
            <Ionicons name="person-remove-outline" size={28} color={c.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>User not available</Text>
          <Text style={styles.emptyBody}>
            This account can&apos;t be viewed. They may have blocked you, or you may have blocked
            them.
          </Text>
        </View>
      </View>
    );
  }

  if (loading || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const birthdayLabel = formatBirthday(profile.date_of_birth);
  const zodiac = zodiacFromIso(profile.date_of_birth);
  const isPending = sent || friendshipStatus === 'pending';
  const isAccepted = friendshipStatus === 'accepted';

  const isIncomingRequest = friendshipStatus === 'pending' && !iSentRequest && !sent;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Image source={{ uri: HERO_BG_URL }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.heroScrim} />

          <SafeAreaView edges={['top']} style={styles.heroTopBar}>
            <View style={styles.heroTopBarRow}>
              <CircleIconButton icon="chevron-back" onPress={() => router.back()} />
              <View style={{ width: 38 }} />
            </View>
          </SafeAreaView>

          <View style={styles.heroBottom}>
            <Avatar uri={profile.avatar_url} name={profile.display_name} size={84} />
            <Text style={styles.displayName}>{profile.display_name}</Text>
            <Text style={styles.username}>@{profile.username}</Text>

            <View style={styles.tabRow}>
              <View style={[styles.tabPill, styles.tabPillActive]}>
                <Text style={styles.tabPillTextActive}>Profile</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statRow}>
          {birthdayLabel && (
            <View style={styles.statPill}>
              <Text style={styles.statEmoji}>🎈</Text>
              <Text style={styles.statText}>{birthdayLabel}</Text>
            </View>
          )}

          <View style={styles.statPill}>
            <Text style={styles.statEmoji}>👻</Text>
            <Text style={styles.statText}>{profile.snap_score.toLocaleString()}</Text>
          </View>

          {zodiac && (
            <View style={styles.statPill}>
              <Text style={styles.statEmoji}>{zodiac.symbol}</Text>
              <Text style={styles.statText}>{zodiac.name}</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {!statusLoaded ? (
            <View style={[styles.primaryBtn, { backgroundColor: c.surfaceElevated }]}>
              <ActivityIndicator color={c.accent} size="small" />
            </View>
          ) : isAccepted ? (
            <Pressable
              onPress={handleUnfriend}
              disabled={actionLoading}
              style={[styles.primaryBtn, { backgroundColor: c.surfaceElevated }]}>
              {actionLoading ? (
                <ActivityIndicator color={c.textPrimary} size="small" />
              ) : (
                <Text style={[styles.primaryBtnText, { color: c.textPrimary }]}>✓ Friends</Text>
              )}
            </Pressable>
          ) : isIncomingRequest ? (
            actionLoading ? (
              <View style={[styles.primaryBtn, { backgroundColor: c.surfaceElevated }]}>
                <ActivityIndicator color={c.accent} size="small" />
              </View>
            ) : (
              <View style={styles.requestRow}>
                <Pressable
                  onPress={handleDecline}
                  style={[styles.requestBtn, { backgroundColor: c.surfaceElevated }]}>
                  <Text style={[styles.primaryBtnText, { color: c.textPrimary }]}>Decline</Text>
                </Pressable>
                <Pressable
                  onPress={handleAccept}
                  style={[styles.requestBtn, { backgroundColor: c.accent }]}>
                  <Text style={[styles.primaryBtnText, { color: c.accentText }]}>Accept</Text>
                </Pressable>
              </View>
            )
          ) : (
            <Pressable
              onPress={!isPending ? handleAdd : undefined}
              disabled={isPending || actionLoading}
              style={[
                styles.primaryBtn,
                { backgroundColor: isPending ? c.surfaceElevated : c.accent },
              ]}>
              {actionLoading ? (
                <ActivityIndicator color={c.accentText} size="small" />
              ) : (
                <Text
                  style={[
                    styles.primaryBtnText,
                    { color: isPending ? c.textMuted : c.accentText },
                  ]}>
                  {isPending ? 'Pending' : 'Add Friend'}
                </Text>
              )}
            </Pressable>
          )}

          <Pressable
            onPress={handleBlock}
            style={[styles.secondaryBtn, { backgroundColor: c.surfaceElevated }]}>
            <Ionicons name="ban-outline" size={16} color={c.danger} />
            <Text style={[styles.secondaryBtnText, { color: c.danger }]}>Block</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function CircleIconButton({
  icon,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon} size={20} color="#FFFFFF" />
    </Pressable>
  );
}

function useStyles(c: ThemeColors) {
  return StyleSheet.create({
    plainHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 10,
    },
    headerBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hero: {
      height: 360,
      overflow: 'hidden',
    },
    heroScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.18)',
    },
    heroTopBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    heroTopBarRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 6,
    },
    heroBottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 16,
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    displayName: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '700',
      marginTop: 10,
    },
    username: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13,
      marginTop: 2,
    },
    tabRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      width: '100%',
    },
    tabPill: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 999,
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
    },
    tabPillActive: {
      backgroundColor: 'rgba(255,255,255,0.28)',
      borderColor: '#FFFFFF',
    },
    tabPillTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 13,
    },
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 16,
    },
    statPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.surfaceElevated,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    statEmoji: {
      fontSize: 14,
    },
    statText: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    actions: {
      paddingHorizontal: 16,
      marginTop: 24,
      gap: 10,
    },
    primaryBtn: {
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: '700',
    },
    requestRow: {
      flexDirection: 'row',
      gap: 10,
    },
    requestBtn: {
      flex: 1,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtn: {
      borderRadius: 999,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    secondaryBtnText: {
      fontSize: 14,
      fontWeight: '600',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    emptyTitle: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 6,
    },
    emptyBody: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
