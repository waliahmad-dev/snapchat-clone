import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@lib/supabase/client';
import { Avatar } from '@components/ui/Avatar';
import { useAuthStore } from '@features/auth/store/authStore';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';
import type { DbUser } from '@/types/database';

interface BlockedEntry extends DbUser {
  blockId: string;
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const styles = useStyles(c);
  const profile = useAuthStore((s) => s.profile);
  const [blocked, setBlocked] = useState<BlockedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: blocks } = await supabase
        .from('blocks')
        .select('id, blocked_id')
        .eq('blocker_id', profile.id);

      if (!blocks || blocks.length === 0) {
        setBlocked([]);
        return;
      }

      const ids = blocks.map((b: { blocked_id: string }) => b.blocked_id);
      const { data: users } = await supabase.from('users').select('*').in('id', ids);

      const blockMap = new Map(
        blocks.map((b: { id: string; blocked_id: string }) => [b.blocked_id, b.id]),
      );
      setBlocked((users ?? []).map((u: DbUser) => ({ ...u, blockId: blockMap.get(u.id)! })));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  function unblock(blockId: string, name: string) {
    Alert.alert(
      `Unblock ${name}?`,
      'They will be discoverable in search again, but no friendship, messages, or streak will be restored. You both have to add each other and start fresh.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            await supabase.from('blocks').delete().eq('id', blockId);
            setBlocked((prev) => prev.filter((u) => u.blockId !== blockId));
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Blocked</Text>
          <View style={styles.headerBtn} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : blocked.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: c.iconCircleBg }]}>
            <Ionicons name="ban-outline" size={28} color={c.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No blocked users</Text>
          <Text style={styles.emptyBody}>
            People you block won&apos;t be able to find you in search or contact you.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 48 }}
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>Blocked ({blocked.length})</Text>
          }
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.row,
                {
                  backgroundColor: c.surfaceElevated,
                  marginHorizontal: 16,
                  borderTopLeftRadius: index === 0 ? 14 : 0,
                  borderTopRightRadius: index === 0 ? 14 : 0,
                  borderBottomLeftRadius: index === blocked.length - 1 ? 14 : 0,
                  borderBottomRightRadius: index === blocked.length - 1 ? 14 : 0,
                },
              ]}>
              <Avatar uri={item.avatar_url} name={item.display_name} size={40} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text numberOfLines={1} style={styles.name}>
                  {item.display_name}
                </Text>
                <Text numberOfLines={1} style={styles.username}>
                  @{item.username}
                </Text>
              </View>
              <Pressable
                onPress={() => unblock(item.blockId, item.display_name)}
                android_ripple={{ color: c.rowPress }}
                style={[styles.unblockBtn, { backgroundColor: c.iconCircleBg }]}>
                <Text style={styles.unblockText}>Unblock</Text>
              </Pressable>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
        />
      )}
    </View>
  );
}

function useStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: {
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
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: c.textPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    sectionLabel: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      paddingHorizontal: 24,
      paddingBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: 16 + 14 + 40 + 12,
    },
    name: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    username: {
      color: c.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    unblockBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      marginLeft: 8,
    },
    unblockText: {
      color: c.textPrimary,
      fontSize: 13,
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
