import React, { useState } from 'react';
import { View, Text, Pressable, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function NotificationsScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const [messages, setMessages] = useState(true);
  const [stories, setStories] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);
  const [streakReminders, setStreakReminders] = useState(true);

  function row(label: string, sub: string, value: boolean, onChange: (v: boolean) => void) {
    return (
      <View
        className="flex-row items-center px-4 py-4 border-b"
        style={{ borderColor: c.divider }}>
        <View className="flex-1 mr-4">
          <Text className="font-medium" style={{ color: c.textPrimary }}>
            {label}
          </Text>
          <Text className="text-sm" style={{ color: c.textSecondary }}>
            {sub}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: c.scheme === 'dark' ? '#3A3A3A' : '#D1D1D6', true: c.accent }}
          thumbColor="#FFFFFF"
        />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: c.bg }}>
      <View className="flex-row items-center px-4 py-4">
        <Pressable onPress={() => router.back()}>
          <Text className="text-2xl" style={{ color: c.textPrimary }}>
            ‹
          </Text>
        </Pressable>
        <Text className="font-bold text-xl ml-4" style={{ color: c.textPrimary }}>
          Notifications
        </Text>
      </View>

      <ScrollView>
        <View
          className="mt-4 rounded-xl mx-4"
          style={{ backgroundColor: c.surfaceElevated }}>
          {row('Messages', 'New snaps and chats', messages, setMessages)}
          {row('Stories', 'When friends post stories', stories, setStories)}
          {row('Friend Requests', 'New friend requests', friendRequests, setFriendRequests)}
          {row(
            'Streak Reminders',
            'Before a streak is about to expire',
            streakReminders,
            setStreakReminders,
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
