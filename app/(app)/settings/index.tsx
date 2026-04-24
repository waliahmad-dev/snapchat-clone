import React from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from '@features/auth/utils/authHelpers';
import { useAuthStore } from '@features/auth/store/authStore';
import { ScreenHeader } from '@components/ui/ScreenHeader';

function SettingRow({
  icon,
  label,
  onPress,
  danger = false,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
  value?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-4 border-b border-gray-100 active:bg-gray-50">
      <View className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center mr-3">
        <Ionicons name={icon} size={18} color={danger ? '#FF3B30' : '#111'} />
      </View>
      <Text className={`flex-1 font-medium ${danger ? 'text-red-500' : 'text-black'}`}>
        {label}
      </Text>
      {value && <Text className="text-gray-500 text-sm mr-2">{value}</Text>}
      {!danger && <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title="Settings" />

      <ScrollView>
        <Text className="text-gray-500 text-xs font-semibold px-4 pt-5 pb-2 uppercase tracking-wider">
          Account
        </Text>
        <View className="bg-white">
          <SettingRow icon="person-outline" label="Username" value={`@${profile?.username}`} onPress={() => {}} />
          <SettingRow icon="mail-outline" label="Email" onPress={() => {}} />
          <SettingRow icon="key-outline" label="Change Password" onPress={() => {}} />
        </View>

        <Text className="text-gray-500 text-xs font-semibold px-4 pt-5 pb-2 uppercase tracking-wider">
          Privacy & Safety
        </Text>
        <View className="bg-white">
          <SettingRow
            icon="lock-closed-outline"
            label="Privacy Controls"
            onPress={() => router.push('/(app)/settings/privacy')}
          />
        </View>

        <Text className="text-gray-500 text-xs font-semibold px-4 pt-5 pb-2 uppercase tracking-wider">
          Notifications
        </Text>
        <View className="bg-white">
          <SettingRow
            icon="notifications-outline"
            label="Notification Settings"
            onPress={() => router.push('/(app)/settings/notifications')}
          />
        </View>

        <Text className="text-gray-500 text-xs font-semibold px-4 pt-5 pb-2 uppercase tracking-wider">
          Storage
        </Text>
        <View className="bg-white">
          <SettingRow
            icon="save-outline"
            label="Storage Management"
            onPress={() => router.push('/(app)/settings/storage')}
          />
        </View>

        <View className="mt-6 mb-10 bg-white">
          <SettingRow
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleSignOut}
            danger
          />
        </View>
      </ScrollView>
    </View>
  );
}
