import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNetworkStore } from '@lib/offline/networkStore';
import { usePendingCount } from '@lib/offline/usePendingCount';
import { useThemeColors } from '@lib/theme/useThemeColors';

export function OfflineBanner() {
  const c = useThemeColors();
  const { t } = useTranslation();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const pending = usePendingCount();
  const [visible, setVisible] = useState(false);
  const slide = useRef(new Animated.Value(-60)).current;

  const shouldShow = !isOnline || pending > 0;

  useEffect(() => {
    if (shouldShow) {
      setVisible(true);
      Animated.timing(slide, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else if (visible) {
      Animated.timing(slide, {
        toValue: -60,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }
  }, [shouldShow, slide, visible]);

  if (!visible) return null;

  const offlineMode = !isOnline;
  const bg = offlineMode ? '#3A3A3A' : c.accent;
  const fg = offlineMode ? '#FFFFFF' : c.accentText;
  const label = offlineMode
    ? pending > 0
      ? t('common.offlineWaiting', { count: pending })
      : t('common.offlineNoItems')
    : t('common.syncingItems', { count: pending });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          backgroundColor: bg,
          transform: [{ translateY: slide }],
        },
      ]}>
      <View style={styles.inner}>
        <Ionicons
          name={offlineMode ? 'cloud-offline-outline' : 'sync'}
          size={14}
          color={fg}
          style={{ marginRight: 6 }}
        />
        <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingTop: 36,
    paddingBottom: 8,
    alignItems: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
