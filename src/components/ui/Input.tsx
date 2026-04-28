import React from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: Props) {
  const c = useThemeColors();
  return (
    <View className="w-full">
      {label ? (
        <Text
          className="text-sm mb-1 font-medium"
          style={{ color: c.textSecondary }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        className="rounded-xl px-4 py-3 text-base border"
        style={[
          {
            backgroundColor: c.inputBg,
            color: c.textPrimary,
            borderColor: error ? c.danger : 'transparent',
          },
          style,
        ]}
        placeholderTextColor={c.placeholder}
        {...props}
      />
      {error ? (
        <Text className="text-xs mt-1" style={{ color: c.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
