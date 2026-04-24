import React from 'react';
import { View } from 'react-native';
import { SwipeNavigator } from '@navigation/SwipeNavigator';
import { ChatListPanel } from '@/panels/ChatListPanel';
import { CameraMainPanel } from '@/panels/CameraMainPanel';
import { StoriesFeedPanel } from '@/panels/StoriesFeedPanel';

export default function MainScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SwipeNavigator
        chatPanel={<ChatListPanel />}
        cameraPanel={<CameraMainPanel />}
        storiesPanel={<StoriesFeedPanel />}
      />
    </View>
  );
}
