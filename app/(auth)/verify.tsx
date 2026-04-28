import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@lib/supabase/client';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function VerifyScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });
      if (error) throw error;
      router.replace('/(app)/camera');
    } catch (err: any) {
      Alert.alert('Verification failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (!error) Alert.alert('Code sent', `A new code was sent to ${email}`);
  }

  const submitDisabled = code.length < 6;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View className="flex-1 justify-center px-8">
        <Text className="text-5xl text-center mb-3" style={{ color: c.accent }}>
          📬
        </Text>
        <Text
          className="font-bold text-2xl text-center mb-2"
          style={{ color: c.textPrimary }}>
          Check your email
        </Text>
        <Text className="text-center mb-8" style={{ color: c.textSecondary }}>
          We sent a 6-digit code to{' '}
          <Text className="font-medium" style={{ color: c.textPrimary }}>
            {email}
          </Text>
        </Text>

        <TextInput
          className="text-center text-3xl font-bold rounded-xl py-4 tracking-widest mb-6"
          style={{ backgroundColor: c.inputBg, color: c.textPrimary }}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="------"
          placeholderTextColor={c.placeholder}
          autoFocus
        />

        <Pressable
          onPress={handleVerify}
          disabled={loading || submitDisabled}
          className="rounded-full py-4 items-center mb-4"
          style={{ backgroundColor: c.accent, opacity: submitDisabled ? 0.4 : 1 }}>
          {loading ? (
            <ActivityIndicator color={c.accentText} />
          ) : (
            <Text className="font-bold text-lg" style={{ color: c.accentText }}>
              Verify
            </Text>
          )}
        </Pressable>

        <Pressable onPress={handleResend} className="items-center">
          <Text className="text-sm" style={{ color: c.textSecondary }}>
            Didn't get it?{' '}
            <Text className="font-semibold" style={{ color: c.accent }}>
              Resend code
            </Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
