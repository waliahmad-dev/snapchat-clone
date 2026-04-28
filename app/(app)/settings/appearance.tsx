import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';
import { useThemeStore, type ThemeMode } from '@lib/theme/themeStore';

const OPTIONS: {
  value: ThemeMode;
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  {
    value: 'system',
    label: 'System',
    description: 'Match your device appearance',
    icon: 'phone-portrait-outline',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Always use light mode',
    icon: 'sunny-outline',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Always use dark mode',
    icon: 'moon-outline',
  },
];

export default function AppearanceScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const styles = useStyles(c);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Appearance</Text>
          <View style={styles.headerBtn} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 48 }}>
        <Text style={styles.sectionLabel}>Theme</Text>
        <View style={styles.group}>
          {OPTIONS.map((opt, idx) => (
            <React.Fragment key={opt.value}>
              <Pressable
                onPress={() => setMode(opt.value)}
                android_ripple={{ color: c.rowPress }}
                style={styles.row}>
                <View style={[styles.iconCircle, { backgroundColor: c.iconCircleBg }]}>
                  <Ionicons name={opt.icon} size={18} color={c.textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{opt.label}</Text>
                  <Text style={styles.description}>{opt.description}</Text>
                </View>
                {mode === opt.value ? (
                  <Ionicons name="checkmark" size={22} color={c.accent} />
                ) : (
                  <View style={{ width: 22 }} />
                )}
              </Pressable>
              {idx < OPTIONS.length - 1 && <View style={styles.divider} />}
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
    footnote: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 18,
      paddingHorizontal: 24,
      paddingTop: 14,
    },
  });
}
