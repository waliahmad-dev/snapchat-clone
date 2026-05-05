import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';
import { useLocale, LANGUAGE_LABEL, LANGUAGE_FLAG } from '@lib/i18n/useLocale';
import { SUPPORTED_LOCALES, type Locale } from '@lib/i18n';

const DESCRIPTIONS: Record<Locale, string> = {
  en: 'Use English throughout the app',
  fr: 'Utiliser le français dans toute l’application',
  es: 'Usar español en toda la aplicación',
};

export default function LanguageScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useThemeColors();
  const styles = useStyles(c);
  const { locale, setLocale } = useLocale();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('settings.language.title')}</Text>
          <View style={styles.headerBtn} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 48 }}>
        <Text style={styles.sectionLabel}>{t('settings.language.sectionLabel')}</Text>
        <View style={styles.group}>
          {SUPPORTED_LOCALES.map((l, idx) => (
            <React.Fragment key={l}>
              <Pressable
                onPress={() => setLocale(l)}
                android_ripple={{ color: c.rowPress }}
                style={styles.row}>
                <View style={[styles.iconCircle, { backgroundColor: c.iconCircleBg }]}>
                  <Text style={{ fontSize: 18 }}>{LANGUAGE_FLAG[l]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{LANGUAGE_LABEL[l]}</Text>
                  <Text style={styles.description}>{DESCRIPTIONS[l]}</Text>
                </View>
                {locale === l ? (
                  <Ionicons name="checkmark" size={22} color={c.accent} />
                ) : (
                  <View style={{ width: 22 }} />
                )}
              </Pressable>
              {idx < SUPPORTED_LOCALES.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
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
