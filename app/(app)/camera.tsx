import React from 'react';
import { View } from 'react-native';
import { SwipeNavigator } from '@navigation/SwipeNavigator';
import { ChatListPanel } from '@/panels/ChatListPanel';
import { CameraMainPanel } from '@/panels/CameraMainPanel';
import { StoriesFeedPanel } from '@/panels/StoriesFeedPanel';
import { useThemeColors } from '@lib/theme/useThemeColors';

export default function MainScreen() {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SwipeNavigator
        chatPanel={<ChatListPanel />}
        cameraPanel={<CameraMainPanel />}
        storiesPanel={<StoriesFeedPanel />}
      />
    </View>
  );
}
