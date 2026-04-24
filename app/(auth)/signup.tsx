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

export default function SignupScreen() {
  const router = useRouter();
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

  return (
    <SafeAreaView className="flex-1 bg-black">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView className="flex-1 px-8" contentContainerStyle={{ paddingBottom: 40 }}>
          <Pressable onPress={() => router.back()} className="mt-8 mb-8">
            <Text className="text-snap-yellow text-base">← Back</Text>
          </Pressable>

          <Text className="text-white text-3xl font-bold mb-8">Create Account</Text>

          <TextInput
            className="bg-snap-surface text-white rounded-xl px-4 py-4 mb-4 text-base"
            placeholder="Display Name"
            placeholderTextColor="#8A8A8A"
            value={displayName}
            onChangeText={setDisplayName}
            autoComplete="name"
          />
          <TextInput
            className="bg-snap-surface text-white rounded-xl px-4 py-4 mb-4 text-base"
            placeholder="Username (e.g. snapuser42)"
            placeholderTextColor="#8A8A8A"
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase())}
            autoCapitalize="none"
            autoComplete="username-new"
          />
          <TextInput
            className="bg-snap-surface text-white rounded-xl px-4 py-4 mb-4 text-base"
            placeholder="Email"
            placeholderTextColor="#8A8A8A"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            className="bg-snap-surface text-white rounded-xl px-4 py-4 mb-8 text-base"
            placeholder="Password (8+ characters)"
            placeholderTextColor="#8A8A8A"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />

          <Pressable
            onPress={handleSignup}
            disabled={loading}
            className="bg-snap-yellow rounded-full py-4 items-center">
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-black font-bold text-base">Create Account</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
