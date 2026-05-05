import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { signInWithEmail } from '@features/auth/utils/authHelpers';
import { useThemeColors } from '@lib/theme/useThemeColors';
import { LanguagePill } from '@components/ui/LanguagePill';

export default function LoginScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('auth.login.errorFillAll'));
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email.trim().toLowerCase(), password);
    } catch (err: any) {
      Alert.alert(t('auth.login.failed'), err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
      <View style={{ position: 'absolute', top: insets.top + 8, right: 16, zIndex: 10 }}>
        <LanguagePill />
      </View>
      <View className="flex-1 px-8 pt-8">
        <Pressable onPress={() => router.back()} className="mb-8">
          <Text className="text-base" style={{ color: c.accent }}>
            {t('common.back')}
          </Text>
        </Pressable>

        <Text className="mb-8 text-3xl font-bold" style={{ color: c.textPrimary }}>
          {t('auth.login.title')}
        </Text>

        <TextInput
          className="mb-4 rounded-xl px-4 py-4 text-base"
          style={{ backgroundColor: c.inputBg, color: c.textPrimary }}
          placeholder={t('auth.login.emailPlaceholder')}
          placeholderTextColor={c.placeholder}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          className="mb-8 rounded-xl px-4 py-4 text-base"
          style={{ backgroundColor: c.inputBg, color: c.textPrimary }}
          placeholder={t('auth.login.passwordPlaceholder')}
          placeholderTextColor={c.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />

        <Pressable
          onPress={handleLogin}
          disabled={loading}
          className="items-center rounded-full py-4"
          style={{ backgroundColor: c.accent }}>
          {loading ? (
            <ActivityIndicator color={c.accentText} />
          ) : (
            <Text className="text-base font-bold" style={{ color: c.accentText }}>
              {t('auth.login.submit')}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
