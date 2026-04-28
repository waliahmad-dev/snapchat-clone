import { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { signUpWithEmail, checkUsernameAvailable } from '@features/auth/utils/authHelpers';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function SignupScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    const trimmedUsername = username.trim().toLowerCase();
    if (!displayName.trim() || !trimmedUsername || !email.trim() || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!/^[a-z0-9._]{3,20}$/.test(trimmedUsername)) {
      Alert.alert('Invalid Username', 'Use 3–20 characters: letters, numbers, dots, underscores');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const available = await checkUsernameAvailable(trimmedUsername);
      if (!available) {
        Alert.alert('Username Taken', 'Please choose a different username');
        return;
      }
      await signUpWithEmail(
        email.trim().toLowerCase(),
        password,
        trimmedUsername,
        displayName.trim()
      );
      Alert.alert('Check your email', 'We sent a confirmation link to your email.');
    } catch (err: any) {
      Alert.alert('Signup Failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { backgroundColor: c.inputBg, color: c.textPrimary };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView className="flex-1 px-8" contentContainerStyle={{ paddingBottom: 40 }}>
          <Pressable onPress={() => router.back()} className="mt-8 mb-8">
            <Text className="text-base" style={{ color: c.accent }}>
              ← Back
            </Text>
          </Pressable>

          <Text className="text-3xl font-bold mb-8" style={{ color: c.textPrimary }}>
            Create Account
          </Text>

          <TextInput
            className="rounded-xl px-4 py-4 mb-4 text-base"
            style={inputStyle}
            placeholder="Display Name"
            placeholderTextColor={c.placeholder}
            value={displayName}
            onChangeText={setDisplayName}
            autoComplete="name"
          />
          <TextInput
            className="rounded-xl px-4 py-4 mb-4 text-base"
            style={inputStyle}
            placeholder="Username (e.g. snapuser42)"
            placeholderTextColor={c.placeholder}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase())}
            autoCapitalize="none"
            autoComplete="username-new"
          />
          <TextInput
            className="rounded-xl px-4 py-4 mb-4 text-base"
            style={inputStyle}
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
            style={inputStyle}
            placeholder="Password (8+ characters)"
            placeholderTextColor={c.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />

          <Pressable
            onPress={handleSignup}
            disabled={loading}
            className="rounded-full py-4 items-center"
            style={{ backgroundColor: c.accent }}>
            {loading ? (
              <ActivityIndicator color={c.accentText} />
            ) : (
              <Text className="font-bold text-base" style={{ color: c.accentText }}>
                Create Account
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
