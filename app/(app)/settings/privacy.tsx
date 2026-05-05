import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';

export default function PrivacyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useThemeColors();
  const styles = useStyles(c);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('settings.privacy.title')}</Text>
          <View style={styles.headerBtn} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 48 }}>
        <Text style={styles.sectionLabel}>{t('settings.privacy.contact')}</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: c.iconCircleBg }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={c.textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('settings.privacy.whoCanContact')}</Text>
              <Text style={styles.description}>{t('settings.privacy.friendsOnly')}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: c.iconCircleBg }]}>
              <Ionicons name="eye-outline" size={18} color={c.textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('settings.privacy.whoCanView')}</Text>
              <Text style={styles.description}>{t('settings.privacy.friendsOnly')}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('settings.privacy.blocking')}</Text>
        <View style={styles.group}>
          <Pressable
            onPress={() => router.push('/(app)/settings/blocked')}
            android_ripple={{ color: c.rowPress }}
            style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: c.iconCircleBg }]}>
              <Ionicons name="ban-outline" size={18} color={c.textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('settings.privacy.blockedUsers')}</Text>
              <Text style={styles.description}>{t('settings.privacy.manageBlocked')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
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
      paddingTop: 18,
      paddingBottom: 8,
    },
    group: {
      marginHorizontal: 16,
      backgroundColor: c.surfaceElevated,
      borderRadius: 14,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    label: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    description: {
      color: c.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: 58,
    },
  });
}
