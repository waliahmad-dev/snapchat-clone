import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';

export default function StorageScreen() {
  const router = useRouter();
  const [cacheSize, setCacheSize] = useState<string>('Calculating…');
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    calculateCache();
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
      setCacheSize('Unknown');
    }
  }

  async function clearCache() {
    Alert.alert('Clear Cache', 'This will remove cached images and temporary files.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
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
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-4 py-4">
        <Pressable onPress={() => router.back()}>
          <Text className="text-white text-2xl">‹</Text>
        </Pressable>
        <Text className="text-white font-bold text-xl ml-4">Storage</Text>
      </View>

      <ScrollView>
        <View className="mt-4 bg-snap-surface rounded-xl mx-4">
          <View className="px-4 py-4 border-b border-white/5 flex-row items-center justify-between">
            <View>
              <Text className="text-white font-semibold">Cache</Text>
              <Text className="text-snap-gray text-sm">Cached images and media</Text>
            </View>
            <Text className="text-snap-gray">{cacheSize}</Text>
          </View>

          <Pressable
            onPress={clearCache}
            disabled={clearing}
            className="px-4 py-4 flex-row items-center justify-between active:bg-white/5">
            {clearing ? (
              <ActivityIndicator color="#FFFC00" />
            ) : (
              <>
                <Text className="text-snap-yellow font-semibold">Clear Cache</Text>
                <Text className="text-white/30">›</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text className="text-snap-gray text-xs px-8 mt-4 leading-5">
          Clearing the cache will not delete your memories or saved snaps.
          They are stored securely in the cloud.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
