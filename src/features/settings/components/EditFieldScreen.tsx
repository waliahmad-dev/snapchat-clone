import React from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';

type Props = {
  title: string;
  description?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  saving?: boolean;
  saveDanger?: boolean;
  onSave: () => void | Promise<void>;
  children: React.ReactNode;
};

export function EditFieldScreen({
  title,
  description,
  saveLabel,
  saveDisabled,
  saving,
  saveDanger,
  onSave,
  children,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useThemeColors();
  const styles = useStyles(c);
  const resolvedSaveLabel = saveLabel ?? t('common.save');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Pressable
            onPress={() => onSave()}
            hitSlop={10}
            disabled={saveDisabled || saving}
            style={styles.headerBtn}>
            {saving ? (
              <ActivityIndicator size="small" color={c.accent} />
            ) : (
              <Text
                style={{
                  color: saveDisabled
                    ? c.textMuted
                    : saveDanger
                      ? c.danger
                      : c.accent,
                  fontWeight: '700',
                  fontSize: 15,
                }}>
                {resolvedSaveLabel}
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled">
          {description ? <Text style={styles.description}>{description}</Text> : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function useStyledInput() {
  const c = useThemeColors();
  return StyleSheet.create({
    input: {
      backgroundColor: c.inputBg,
      color: c.textPrimary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 16,
    },
    label: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 14,
      marginBottom: 6,
    },
    error: {
      color: c.danger,
      fontSize: 13,
      marginTop: 8,
    },
    hint: {
      color: c.textMuted,
      fontSize: 12,
      marginTop: 8,
    },
  });
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
      minWidth: 60,
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
    description: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 8,
    },
  });
}
