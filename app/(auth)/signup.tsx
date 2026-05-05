import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { signUpWithEmail, checkUsernameAvailable } from '@features/auth/utils/authHelpers';
import { useThemeColors } from '@lib/theme/useThemeColors';
import { LanguagePill } from '@components/ui/LanguagePill';

export default function SignupScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    const trimmedUsername = username.trim().toLowerCase();
    if (!displayName.trim() || !trimmedUsername || !email.trim() || !password) {
      Alert.alert(t('common.error'), t('auth.signup.errorFillAll'));
      return;
    }
    if (!/^[a-z0-9._]{3,20}$/.test(trimmedUsername)) {
      Alert.alert(
        t('auth.signup.errorInvalidUsernameTitle'),
        t('auth.signup.errorInvalidUsername'),
      );
      return;
    }
    if (password.length < 8) {
      Alert.alert(
        t('auth.signup.errorWeakPasswordTitle'),
        t('auth.signup.errorWeakPassword'),
      );
      return;
    }

    setLoading(true);
    try {
      const available = await checkUsernameAvailable(trimmedUsername);
      if (!available) {
        Alert.alert(
          t('auth.signup.usernameTakenTitle'),
          t('auth.signup.usernameTaken'),
        );
        return;
      }
      await signUpWithEmail(
        email.trim().toLowerCase(),
        password,
        trimmedUsername,
        displayName.trim()
      );
      Alert.alert(t('auth.signup.checkEmailTitle'), t('auth.signup.checkEmail'));
    } catch (err: any) {
      Alert.alert(t('auth.signup.failed'), err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { backgroundColor: c.inputBg, color: c.textPrimary };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
      <View style={{ position: 'absolute', top: insets.top + 8, right: 16, zIndex: 10 }}>
        <LanguagePill />
      </View>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView className="flex-1 px-8" contentContainerStyle={{ paddingBottom: 40 }}>
          <Pressable onPress={() => router.back()} className="mb-8 mt-8">
            <Text className="text-base" style={{ color: c.accent }}>
              {t('common.back')}
            </Text>
          </Pressable>

          <Text className="mb-8 text-3xl font-bold" style={{ color: c.textPrimary }}>
            {t('auth.signup.title')}
          </Text>

          <TextInput
            className="mb-4 rounded-xl px-4 py-4 text-base"
            style={inputStyle}
            placeholder={t('auth.signup.displayNamePlaceholder')}
            placeholderTextColor={c.placeholder}
            value={displayName}
            onChangeText={setDisplayName}
            autoComplete="name"
          />
          <TextInput
            className="mb-4 rounded-xl px-4 py-4 text-base"
            style={inputStyle}
            placeholder={t('auth.signup.usernamePlaceholder')}
            placeholderTextColor={c.placeholder}
            value={username}
            onChangeText={(text) => setUsername(text.toLowerCase())}
            autoCapitalize="none"
            autoComplete="username-new"
          />
          <TextInput
            className="mb-4 rounded-xl px-4 py-4 text-base"
            style={inputStyle}
            placeholder={t('auth.signup.emailPlaceholder')}
            placeholderTextColor={c.placeholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            className="mb-8 rounded-xl px-4 py-4 text-base"
            style={inputStyle}
            placeholder={t('auth.signup.passwordPlaceholder')}
            placeholderTextColor={c.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />

          <Pressable
            onPress={handleSignup}
            disabled={loading}
            className="items-center rounded-full py-4"
            style={{ backgroundColor: c.accent }}>
            {loading ? (
              <ActivityIndicator color={c.accentText} />
            ) : (
              <Text className="text-base font-bold" style={{ color: c.accentText }}>
                {t('auth.signup.submit')}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
