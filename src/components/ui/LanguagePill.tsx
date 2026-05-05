import React, { useState } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';
import { useLocale, LANGUAGE_LABEL, LANGUAGE_FLAG } from '@lib/i18n/useLocale';
import { SUPPORTED_LOCALES } from '@lib/i18n';
import { BottomSheet } from './BottomSheet';

interface Props {
  style?: object;
}

export function LanguagePill({ style }: Props) {
  const c = useThemeColors();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);

  const actions = SUPPORTED_LOCALES.map((l) => ({
    label: `${LANGUAGE_FLAG[l]}  ${LANGUAGE_LABEL[l]}${locale === l ? '  ✓' : ''}`,
    onPress: () => {
      void setLocale(l);
    },
  }));

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} style={[styles.pill, style]}>
        <Text style={styles.pillText}>
          {LANGUAGE_FLAG[locale]} {locale.toUpperCase()} ▾
        </Text>
      </Pressable>
      <BottomSheet
        visible={open}
        title={t('common.language')}
        actions={actions}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: c.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    pillText: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
