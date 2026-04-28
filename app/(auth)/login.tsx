import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmail } from '@features/auth/utils/authHelpers';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function LoginScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email.trim().toLowerCase(), password);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
      <View className="flex-1 px-8 pt-8">
        <Pressable onPress={() => router.back()} className="mb-8">
          <Text className="text-base" style={{ color: c.accent }}>
            ← Back
          </Text>
        </Pressable>

        <Text className="text-3xl font-bold mb-8" style={{ color: c.textPrimary }}>
          Log In
        </Text>

        <TextInput
          className="rounded-xl px-4 py-4 mb-4 text-base"
          style={{ backgroundColor: c.inputBg, color: c.textPrimary }}
          placeholder="Email"
          placeholderTextColor={c.placeholder}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          className="rounded-xl px-4 py-4 mb-8 text-base"
          style={{ backgroundColor: c.inputBg, color: c.textPrimary }}
          placeholder="Password"
          placeholderTextColor={c.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />

        <Pressable
          onPress={handleLogin}
          disabled={loading}
          className="rounded-full py-4 items-center"
          style={{ backgroundColor: c.accent }}>
          {loading ? (
            <ActivityIndicator color={c.accentText} />
          ) : (
            <Text className="font-bold text-base" style={{ color: c.accentText }}>
              Log In
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
