import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<string, string> = {
  primary: 'bg-snap-yellow',
  secondary: 'bg-snap-surface border border-white/20',
  ghost: 'bg-transparent',
  danger: 'bg-snap-danger',
};

const textStyles: Record<string, string> = {
  primary: 'text-black font-bold',
  secondary: 'text-white font-semibold',
  ghost: 'text-white font-semibold',
  danger: 'text-white font-bold',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-4 py-2 rounded-lg',
  md: 'px-6 py-3 rounded-xl',
  lg: 'px-8 py-4 rounded-2xl',
};

const textSizeStyles: Record<string, string> = {
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
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`
        items-center justify-center
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50' : 'opacity-100'}
      `}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#000' : '#FFFC00'} size="small" />
      ) : (
        <Text className={`${textStyles[variant]} ${textSizeStyles[size]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
