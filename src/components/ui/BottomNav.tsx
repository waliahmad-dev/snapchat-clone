import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSwipeNavigator } from '@navigation/SwipeNavigator';
import { useUnreadCount } from '@features/chat/hooks/useUnreadCount';
import { useThemeColors } from '@lib/theme/useThemeColors';
import { TAB_COLORS } from '@constants/colors';
import type { SwipePanel } from '@/types/navigation';

export type BottomTab = 'chat' | 'camera' | 'stories';

export const BOTTOM_NAV_HEIGHT = 82;

interface Props {
  active: BottomTab;
}

export function BottomNav({ active }: Props) {
  const c = useThemeColors();
  const { snapToPanel } = useSwipeNavigator();
  const unread = useUnreadCount();

  function go(panel: SwipePanel) {
    snapToPanel(panel);
  }

  return (
    <View
      className="flex-row items-center justify-around px-2 py-3"
      style={{ paddingBottom: 22, backgroundColor: c.bg }}>
      <TabItem
        icon="chatbubble"
        color={active === 'chat' ? TAB_COLORS.chat : c.icon}
        active={active === 'chat'}
        activeColor={TAB_COLORS.chat}
        outlineColor={c.icon}
        badge={unread}
        onPress={() => go('chat')}
      />
      <TabItem
        icon="camera"
        color={active === 'camera' ? '#000000' : c.icon}
        active={active === 'camera'}
        activeColor={TAB_COLORS.camera}
        outlineColor={c.icon}
        emphasis
        onPress={() => go('camera')}
      />
      <TabItem
        icon="people"
        color={active === 'stories' ? TAB_COLORS.stories : c.icon}
        active={active === 'stories'}
        activeColor={TAB_COLORS.stories}
        outlineColor={c.icon}
        onPress={() => go('stories')}
      />
    </View>
  );
}

function TabItem({
  icon,
  color,
  active,
  activeColor,
  outlineColor,
  emphasis = false,
  badge,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  active: boolean;
  activeColor: string;
  outlineColor: string;
  emphasis?: boolean;
  badge?: number;
  onPress?: () => void;
}) {
  const c = useThemeColors();
  const showBadge = typeof badge === 'number' && badge > 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      className="items-center justify-center"
      style={{ minWidth: 48 }}>
      <View style={{ height: 6, alignItems: 'center', marginBottom: 2 }}>
        {active && (
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 5,
              borderRightWidth: 5,
              borderBottomWidth: 6,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: activeColor,
            }}
          />
        )}
      </View>

      <View>
        {emphasis ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: active ? activeColor : 'transparent',
              borderWidth: active ? 0 : 2,
              borderColor: outlineColor,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name={icon} size={22} color={color} />
          </View>
        ) : (
          <Ionicons name={icon} size={26} color={color} />
        )}

        {showBadge && (
          <View
            style={{
              position: 'absolute',
              top: -6,
              right: -10,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: c.danger,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 5,
              borderWidth: 1.5,
              borderColor: c.bg,
            }}>
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
              {badge! > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
