import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useProfile } from '@features/profile/hooks/useProfile';
import { useFriends } from '@features/friends/hooks/useFriends';
import { uploadToStorage, getPublicUrl } from '@lib/supabase/storage';
import { useAuthStore } from '@features/auth/store/authStore';
import { TopDownScreen } from '@components/layout/TopDownScreen';
import { Avatar } from '@components/ui/Avatar';
import { formatBirthday, zodiacFromIso } from '@features/profile/utils/horoscope';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';

const HERO_BG_URL = 'https://picsum.photos/seed/snapclone-profile-bg/1080/1440';

export default function ProfileScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const styles = useStyles(c);
  const { profile, loading, updateProfile } = useProfile();
  const { friends } = useFriends();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [dobOpen, setDobOpen] = useState(false);

  function startEditName() {
    setDisplayName(profile?.display_name ?? '');
    setEditingName(true);
  }

  async function saveName() {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ display_name: displayName.trim() });
      setEditingName(false);
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarPress() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    setSaving(true);
    try {
      const path = `${userId}/${Date.now()}_avatar.jpg`;
      await uploadToStorage('profiles', path, uri);
      const publicUrl = await getPublicUrl('profiles', path);
      await updateProfile({ avatar_url: publicUrl });
    } catch {
      Alert.alert('Upload failed', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) {
    return (
      <TopDownScreen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.accent} />
        </View>
      </TopDownScreen>
    );
  }

  const birthdayLabel = formatBirthday(profile.date_of_birth);
  const zodiac = zodiacFromIso(profile.date_of_birth);

  return (
    <TopDownScreen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Image source={{ uri: HERO_BG_URL }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.heroScrim} />

          <SafeAreaView edges={['top']} style={styles.heroTopBar}>
            <View
              style={[
                styles.heroTopBarRow,
                { justifyContent: 'space-between', alignItems: 'center' },
              ]}>
              <CircleIconButton icon="chevron-back" onPress={() => router.back()} />
              <CircleIconButton
                icon="settings-outline"
                onPress={() => router.push('/(app)/settings')}
              />
            </View>
          </SafeAreaView>

          <View style={styles.heroBottom}>
            <Pressable onPress={handleAvatarPress} style={{ alignSelf: 'center' }}>
              <View>
                <Avatar uri={profile.avatar_url} name={profile.display_name} size={84} />
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="pencil" size={12} color={c.accentText} />
                </View>
              </View>
            </Pressable>

            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoFocus
                  style={styles.nameInput}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                />
                <Pressable onPress={saveName} disabled={saving} hitSlop={6}>
                  {saving ? (
                    <ActivityIndicator color={c.accent} size="small" />
                  ) : (
                    <Text style={{ color: c.accent, fontWeight: '700' }}>Save</Text>
                  )}
                </Pressable>
                <Pressable onPress={() => setEditingName(false)} hitSlop={6}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)' }}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={startEditName} style={styles.nameRow} hitSlop={6}>
                <Text style={styles.displayName}>{profile.display_name}</Text>
                <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.85)" />
              </Pressable>
            )}
            <Text style={styles.username}>{profile.username}</Text>

            <View style={styles.tabRow}>
              <View style={[styles.tabPill, styles.tabPillActive]}>
                <Text style={styles.tabPillTextActive}>My account</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statRow}>
          <Pressable onPress={() => setDobOpen(true)} style={styles.statPill}>
            <Text style={styles.statEmoji}>🎈</Text>
            <Text style={styles.statText}>{birthdayLabel ?? 'Set birthday'}</Text>
            <Ionicons name="chevron-forward" size={12} color={c.textMuted} />
          </Pressable>

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

        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <Text style={styles.sectionLabel}>Post to...</Text>
          <Pressable onPress={() => router.push('/(app)/camera')} style={styles.bigTile}>
            <View style={styles.tileIcon}>
              <Ionicons name="camera" size={22} color={c.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>My Story</Text>
              <Text style={styles.tileSubtitle}>
                <Ionicons name="globe-outline" size={11} color={c.textMuted} /> Friends
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <Text style={styles.sectionLabel}>Friends</Text>
          <Pressable onPress={() => router.push('/(app)/search')} style={styles.bigTile}>
            <View style={styles.tileIcon}>
              <Ionicons name="person-add" size={20} color={c.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>Add Friends</Text>
              <Text style={styles.tileSubtitle}>
                {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/(app)/memories')}
            style={[styles.bigTile, { marginTop: 10 }]}>
            <View style={styles.tileIcon}>
              <Ionicons name="images-outline" size={20} color={c.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>Memories</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>
        </View>
      </ScrollView>

      {dobOpen && (
        <BirthdayEditor
          colors={c}
          initial={profile.date_of_birth}
          onClose={() => setDobOpen(false)}
          onSave={async (iso) => {
            await updateProfile({ date_of_birth: iso });
            setDobOpen(false);
          }}
        />
      )}
    </TopDownScreen>
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

function BirthdayEditor({
  colors,
  initial,
  onClose,
  onSave,
}: {
  colors: ThemeColors;
  initial: string | null;
  onClose: () => void;
  onSave: (iso: string) => Promise<void>;
}) {
  const parsed = initial && /^(\d{4})-(\d{2})-(\d{2})/.exec(initial);
  const [year, setYear] = useState(parsed ? parsed[1] : '2000');
  const [month, setMonth] = useState(parsed ? parsed[2] : '');
  const [day, setDay] = useState(parsed ? parsed[3] : '');
  const [saving, setSaving] = useState(false);

  async function commit() {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (
      !Number.isFinite(y) ||
      y < 1900 ||
      y > new Date().getFullYear() ||
      !Number.isFinite(m) ||
      m < 1 ||
      m > 12 ||
      !Number.isFinite(d) ||
      d < 1 ||
      d > 31
    ) {
      Alert.alert('Invalid date', 'Please enter a valid year, month and day.');
      return;
    }
    setSaving(true);
    try {
      const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      await onSave(iso);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Please try again.';
      const looksLikeMissingColumn =
        /column .*date_of_birth/i.test(msg) || /schema cache/i.test(msg);
      Alert.alert(
        'Could not save birthday',
        looksLikeMissingColumn
          ? 'The date_of_birth column is missing on your users table. Run supabase-add-dob-column.sql in the Supabase SQL editor, then try again.'
          : msg
      );
      setSaving(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
        onPress={onClose}>
        <Pressable
          style={{
            width: '100%',
            backgroundColor: colors.surfaceElevated,
            borderRadius: 18,
            padding: 20,
          }}
          onPress={(e) => e.stopPropagation()}>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700' }}>
            Your birthday
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
            Used to display your zodiac sign.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <TextInput
              value={year}
              onChangeText={setYear}
              placeholder="YYYY"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              maxLength={4}
              style={[dobInputStyle(colors), { flex: 1.2 }]}
            />
            <TextInput
              value={month}
              onChangeText={setMonth}
              placeholder="MM"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              maxLength={2}
              style={[dobInputStyle(colors), { flex: 0.8 }]}
            />
            <TextInput
              value={day}
              onChangeText={setDay}
              placeholder="DD"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              maxLength={2}
              style={[dobInputStyle(colors), { flex: 0.8 }]}
            />
          </View>
          <View
            style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 18 }}>
            <Pressable onPress={onClose} hitSlop={6}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={commit} disabled={saving} hitSlop={6}>
              {saving ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text style={{ color: colors.accent, fontWeight: '700' }}>Save</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function dobInputStyle(c: ThemeColors) {
  return {
    backgroundColor: c.bg,
    color: c.textPrimary,
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    paddingVertical: 10,
    borderRadius: 10,
  };
}

function useStyles(c: ThemeColors) {
  return StyleSheet.create({
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
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 10,
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
    avatarEditBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.bg,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 10,
    },
    nameEditRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
    },
    nameInput: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      minWidth: 160,
      textAlign: 'center',
    },
    displayName: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '700',
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
    sectionLabel: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 8,
    },
    bigTile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surfaceElevated,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    tileIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.iconCircleBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileTitle: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    tileSubtitle: {
      color: c.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
  });
}
