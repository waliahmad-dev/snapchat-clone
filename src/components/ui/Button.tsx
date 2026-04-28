import React from 'react';
import { Pressable, Text, ActivityIndicator, type ViewStyle, type TextStyle } from 'react-native';
import { useThemeColors, type ThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

function variantStyle(variant: NonNullable<Props['variant']>, c: ThemeColors): {
  container: ViewStyle;
  text: TextStyle;
  spinner: string;
} {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: c.accent },
        text: { color: c.accentText, fontWeight: '700' },
        spinner: c.accentText,
      };
    case 'secondary':
      return {
        container: { backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border },
        text: { color: c.textPrimary, fontWeight: '600' },
        spinner: c.accent,
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        text: { color: c.textPrimary, fontWeight: '600' },
        spinner: c.accent,
      };
    case 'danger':
      return {
        container: { backgroundColor: c.danger },
        text: { color: '#FFFFFF', fontWeight: '700' },
        spinner: '#FFFFFF',
      };
  }
}

const sizeClass: Record<NonNullable<Props['size']>, string> = {
  sm: 'px-4 py-2 rounded-lg',
  md: 'px-6 py-3 rounded-xl',
  lg: 'px-8 py-4 rounded-2xl',
};

const textSizeClass: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
}: Props) {
  const c = useThemeColors();
  const style = variantStyle(variant, c);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[style.container, { opacity: isDisabled ? 0.5 : 1 }]}
      className={`items-center justify-center ${sizeClass[size]} ${fullWidth ? 'w-full' : ''}`}>
      {loading ? (
        <ActivityIndicator color={style.spinner} size="small" />
      ) : (
        <Text style={style.text} className={textSizeClass[size]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
