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

export default function VerifyScreen() {
  const router = useRouter();
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

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-black"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View className="flex-1 justify-center px-8">
        <Text className="text-snap-yellow text-5xl text-center mb-3">📬</Text>
        <Text className="text-white font-bold text-2xl text-center mb-2">
          Check your email
        </Text>
        <Text className="text-snap-gray text-center mb-8">
          We sent a 6-digit code to{' '}
          <Text className="text-white font-medium">{email}</Text>
        </Text>

        <TextInput
          className="bg-snap-surface text-white text-center text-3xl font-bold rounded-xl py-4 tracking-widest mb-6"
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="------"
          placeholderTextColor="#444"
          autoFocus
        />

        <Pressable
          onPress={handleVerify}
          disabled={loading || code.length < 6}
          className={`rounded-full py-4 items-center mb-4 ${
            code.length < 6 ? 'bg-snap-yellow/40' : 'bg-snap-yellow'
          }`}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="text-black font-bold text-lg">Verify</Text>
          )}
        </Pressable>

        <Pressable onPress={handleResend} className="items-center">
          <Text className="text-snap-gray text-sm">
            Didn't get it?{' '}
            <Text className="text-snap-yellow font-semibold">Resend code</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
