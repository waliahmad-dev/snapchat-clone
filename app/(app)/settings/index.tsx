import React from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { signOut } from '@features/auth/utils/authHelpers';
import { useAuthStore } from '@features/auth/store/authStore';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';
import { useThemeStore, type ThemeMode } from '@lib/theme/themeStore';
import { useLocale, LANGUAGE_LABEL } from '@lib/i18n/useLocale';
import { formatBirthday } from '@features/profile/utils/horoscope';

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const themeMode = useThemeStore((s) => s.mode);
  const { locale } = useLocale();
  const c = useThemeColors();
  const styles = useStyles(c);

  const themeModeLabel: Record<ThemeMode, string> = {
    system: t('settings.appearance.systemLabel'),
    light: t('settings.appearance.lightLabel'),
    dark: t('settings.appearance.darkLabel'),
  };

  async function handleSignOut() {
    Alert.alert(t('settings.index.logoutConfirmTitle'), t('settings.index.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.index.logout'), style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('settings.index.title')}</Text>
          <View style={styles.headerBtn} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 48, paddingTop: 8 }}>
        <Section title={t('settings.index.myAccount')} colors={c}>
          <Row
            icon="person-outline"
            label={t('settings.index.name')}
            value={profile?.display_name}
            onPress={() => router.push('/(app)/settings/account/name')}
            colors={c}
          />
          <Divider colors={c} />
          <Row
            icon="at-outline"
            label={t('settings.index.username')}
            value={profile?.username}
            onPress={() => router.push('/(app)/settings/account/username')}
            colors={c}
          />
          <Divider colors={c} />
          <Row
            icon="gift-outline"
            label={t('settings.index.birthday')}
            value={formatBirthday(profile?.date_of_birth ?? null) ?? t('settings.index.notSet')}
            onPress={() => router.push('/(app)/settings/account/birthday')}
            colors={c}
          />
          <Divider colors={c} />
          <Row
            icon="call-outline"
            label={t('settings.index.mobile')}
            value={profile?.phone ?? t('settings.index.notSet')}
            onPress={() => router.push('/(app)/settings/account/phone')}
            colors={c}
          />
          <Divider colors={c} />
          <Row
            icon="mail-outline"
            label={t('settings.index.email')}
            value={user?.email ?? undefined}
            onPress={() => router.push('/(app)/settings/account/email')}
            colors={c}
          />
        </Section>

        <Section title={t('settings.index.preferences')} colors={c}>
          <Row
            icon="contrast-outline"
            label={t('settings.index.appearance')}
            value={themeModeLabel[themeMode]}
            onPress={() => router.push('/(app)/settings/appearance')}
            colors={c}
          />
          <Divider colors={c} />
          <Row
            icon="language-outline"
            label={t('settings.index.language')}
            value={LANGUAGE_LABEL[locale]}
            onPress={() => router.push('/(app)/settings/language')}
            colors={c}
          />
        </Section>

        <Section title={t('settings.index.privacy')} colors={c}>
          <Row
            icon="ban-outline"
            label={t('settings.index.blockedUsers')}
            onPress={() => router.push('/(app)/settings/blocked')}
            colors={c}
          />
        </Section>

        <Section title={t('settings.index.loginSecurity')} colors={c}>
          <Row
            icon="key-outline"
            label={t('settings.index.password')}
            onPress={() => router.push('/(app)/settings/account/password')}
            colors={c}
          />
        </Section>

        <Section title={t('settings.index.accountDeletion')} colors={c}>
          <Row
            icon="trash-outline"
            label={t('settings.index.deleteMyAccount')}
            onPress={() => router.push('/(app)/settings/account/delete')}
            colors={c}
            danger
          />
        </Section>

        <Section title={t('settings.index.logoutSection')} colors={c}>
          <Row
            icon="log-out-outline"
            label={t('settings.index.logout')}
            onPress={handleSignOut}
            colors={c}
            danger
          />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ThemeColors;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          paddingHorizontal: 24,
          paddingBottom: 8,
        }}>
        {title}
      </Text>
      <View
        style={{
          marginHorizontal: 16,
          backgroundColor: colors.surfaceElevated,
          borderRadius: 14,
          overflow: 'hidden',
        }}>
        {children}
      </View>
    </View>
  );
}

function Divider({ colors }: { colors: ThemeColors }) {
  return (
    <View
      style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 56 }}
    />
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  colors,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  onPress: () => void;
  colors: ThemeColors;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.rowPress }}
      style={rowContainerStyle}>
      <View style={[rowIconStyle, { backgroundColor: colors.iconCircleBg }]}>
        <Ionicons name={icon} size={17} color={danger ? colors.danger : colors.textPrimary} />
      </View>

      <Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          color: danger ? colors.danger : colors.textPrimary,
          fontSize: 15,
          fontWeight: '500',
        }}>
        {label}
      </Text>

      {value ? (
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: 'right',
            color: colors.textMuted,
            fontSize: 14,
            marginLeft: 12,
          }}>
          {value}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.textMuted}
        style={{ marginLeft: 8 }}
      />
    </Pressable>
  );
}

const rowContainerStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  paddingHorizontal: 14,
  paddingVertical: 12,
};

const rowIconStyle = {
  width: 30,
  height: 30,
  borderRadius: 8,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginRight: 12,
};

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
  });
}
