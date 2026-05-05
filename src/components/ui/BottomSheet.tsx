import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';

const { height: SCREEN_H } = Dimensions.get('window');

interface Action {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  title?: string;
  actions: Action[];
  onClose: () => void;
}

export function BottomSheet({ visible, title, actions, onClose }: Props) {
  const c = useThemeColors();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const translateY = useSharedValue(SCREEN_H);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 24, stiffness: 110, mass: 1 });
      backdropOpacity.value = withTiming(1, { duration: 280 });
    } else {
      translateY.value = withTiming(SCREEN_H, { duration: 240 });
      backdropOpacity.value = withTiming(0, { duration: 240 });
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          {title ? (
            <View style={styles.titleRow}>
              <Text style={styles.title}>{title}</Text>
            </View>
          ) : null}

          {actions.map((action, i) => (
            <Pressable
              key={i}
              style={[styles.action, i < actions.length - 1 && styles.actionBorder]}
              onPress={() => {
                onClose();
                action.onPress();
              }}>
              <Text
                style={[styles.actionText, action.destructive && styles.destructiveText]}>
                {action.label}
              </Text>
            </Pressable>
          ))}

          <Pressable style={[styles.action, styles.cancelAction]} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      backgroundColor: c.overlay,
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.surfaceElevated,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 34,
    },
    titleRow: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      alignItems: 'center',
    },
    title: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
    },
    action: {
      paddingVertical: 18,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    actionBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    actionText: {
      color: c.textPrimary,
      fontSize: 17,
    },
    destructiveText: {
      color: c.danger,
    },
    cancelAction: {
      marginTop: 8,
      backgroundColor: c.surface,
      marginHorizontal: 16,
      borderRadius: 12,
    },
    cancelText: {
      color: c.textPrimary,
      fontSize: 17,
      fontWeight: '600',
    },
  });
}
