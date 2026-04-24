import React from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: Props) {
  return (
    <View className="w-full">
      {label ? (
        <Text className="text-snap-gray text-sm mb-1 font-medium">{label}</Text>
      ) : null}
      <TextInput
        className={`
          bg-snap-surface text-white rounded-xl px-4 py-3 text-base
          ${error ? 'border border-snap-danger' : 'border border-transparent'}
        `}
        placeholderTextColor="#8A8A8A"
        {...props}
      />
      {error ? (
        <Text className="text-snap-danger text-xs mt-1">{error}</Text>
      ) : null}
    </View>
  );
}
