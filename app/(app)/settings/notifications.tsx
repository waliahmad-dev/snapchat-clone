import React, { useState } from 'react';
import { View, Text, Pressable, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState(true);
  const [stories, setStories] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);
  const [streakReminders, setStreakReminders] = useState(true);

  function row(label: string, sub: string, value: boolean, onChange: (v: boolean) => void) {
    return (
      <View className="flex-row items-center px-4 py-4 border-b border-white/5">
        <View className="flex-1 mr-4">
          <Text className="text-white font-medium">{label}</Text>
          <Text className="text-snap-gray text-sm">{sub}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: '#3A3A3A', true: '#FFFC00' }}
          thumbColor="#fff"
        />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-4 py-4">
        <Pressable onPress={() => router.back()}>
          <Text className="text-white text-2xl">‹</Text>
        </Pressable>
        <Text className="text-white font-bold text-xl ml-4">Notifications</Text>
      </View>

      <ScrollView>
        <View className="mt-4 bg-snap-surface rounded-xl mx-4">
          {row('Messages', 'New snaps and chats', messages, setMessages)}
          {row('Stories', 'When friends post stories', stories, setStories)}
          {row('Friend Requests', 'New friend requests', friendRequests, setFriendRequests)}
          {row('Streak Reminders', 'Before a streak is about to expire', streakReminders, setStreakReminders)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
