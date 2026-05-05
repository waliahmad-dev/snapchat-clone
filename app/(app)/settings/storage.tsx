import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function StorageScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const c = useThemeColors();
  const [cacheSize, setCacheSize] = useState<string>(t('settings.storage.cacheCalculating'));
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    calculateCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function calculateCache() {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return;
      const info = await FileSystem.getInfoAsync(cacheDir);
      if (info.exists && 'size' in info && info.size) {
        const mb = (info.size / 1024 / 1024).toFixed(1);
        setCacheSize(`${mb} MB`);
      } else {
        setCacheSize('0 MB');
      }
    } catch {
      setCacheSize(t('settings.storage.cacheUnknown'));
    }
  }

  async function clearCache() {
    Alert.alert(
      t('settings.storage.clearCache'),
      t('settings.storage.clearCacheBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.storage.clear'),
          onPress: async () => {
            setClearing(true);
            try {
              const cacheDir = FileSystem.cacheDirectory;
              if (cacheDir) {
                const contents = await FileSystem.readDirectoryAsync(cacheDir);
                await Promise.all(
                  contents.map((file) =>
                    FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true })
                  )
                );
              }
              setCacheSize('0 MB');
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
      <View className="flex-row items-center px-4 py-4">
        <Pressable onPress={() => router.back()}>
          <Text className="text-2xl" style={{ color: c.textPrimary }}>
            ‹
          </Text>
        </Pressable>
        <Text className="font-bold text-xl ml-4" style={{ color: c.textPrimary }}>
          {t('settings.storage.title')}
        </Text>
      </View>

      <ScrollView>
        <View
          className="mt-4 rounded-xl mx-4"
          style={{ backgroundColor: c.surfaceElevated }}>
          <View
            className="px-4 py-4 border-b flex-row items-center justify-between"
            style={{ borderColor: c.divider }}>
            <View>
              <Text className="font-semibold" style={{ color: c.textPrimary }}>
                {t('settings.storage.cache')}
              </Text>
              <Text className="text-sm" style={{ color: c.textSecondary }}>
                {t('settings.storage.cacheSub')}
              </Text>
            </View>
            <Text style={{ color: c.textSecondary }}>{cacheSize}</Text>
          </View>

          <Pressable
            onPress={clearCache}
            disabled={clearing}
            android_ripple={{ color: c.rowPress }}
            className="px-4 py-4 flex-row items-center justify-between">
            {clearing ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <>
                <Text className="font-semibold" style={{ color: c.accent }}>
                  {t('settings.storage.clearCache')}
                </Text>
                <Text style={{ color: c.textMuted }}>›</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text className="text-xs px-8 mt-4 leading-5" style={{ color: c.textSecondary }}>
          {t('settings.storage.cacheNote')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
