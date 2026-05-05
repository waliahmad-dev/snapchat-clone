import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { SCREEN_HEIGHT } from '@constants/dimensions';
import { useRouter } from 'expo-router';

const SPRING_CONFIG = { damping: 30, stiffness: 250 };
const OPEN_THRESHOLD = -80; 

interface Props {
  children: React.ReactNode;
}

export function MemoriesSheetProvider({ children }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const translateY = useSharedValue(0);
  const isOpen = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .runOnJS(false)
    .activeOffsetY([-15, 15])
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      if (isOpen.value) {
        translateY.value = Math.max(0, e.translationY);
      } else {
        translateY.value = Math.min(0, e.translationY);
      }
    })
    .onEnd((e) => {
      if (!isOpen.value && e.translationY < OPEN_THRESHOLD) {
        isOpen.value = true;
        translateY.value = withSpring(-SCREEN_HEIGHT + 80, SPRING_CONFIG);
      } else if (isOpen.value && e.translationY > 80) {
        isOpen.value = false;
        translateY.value = withSpring(0, SPRING_CONFIG);
      } else {
        translateY.value = withSpring(isOpen.value ? -SCREEN_HEIGHT + 80 : 0, SPRING_CONFIG);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, -(SCREEN_HEIGHT - 80)], [0, 0.6], Extrapolation.CLAMP),
    pointerEvents: translateY.value < -20 ? 'auto' : 'none',
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      {children}

      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, overlayOpacity]}
        pointerEvents="none"
      />

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View className="items-center py-2">
            <View className="w-10 h-1 rounded-full bg-white/30" />
          </View>

          <View className="flex-1 items-center justify-center">
            <Pressable
              onPress={() => {
                isOpen.value = false;
                translateY.value = withSpring(0, SPRING_CONFIG);
                router.push('/(app)/memories');
              }}>
              <Text className="text-white text-base">{t('memories.open')}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    top: SCREEN_HEIGHT,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT - 80,
    backgroundColor: '#111',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});
