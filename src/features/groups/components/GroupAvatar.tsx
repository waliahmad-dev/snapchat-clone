import React from 'react';
import { View, Text, Image } from 'react-native';
import type { DbUser } from '@/types/database';
import { useThemeColors } from '@lib/theme/useThemeColors';

interface Props {
  members: DbUser[];
  avatarUrl?: string | null;
  size?: number;
}

/**
 * Up to two stacked member avatars (Snapchat-style overlap), or the
 * group's avatar_url if set.
 */
export function GroupAvatar({ members, avatarUrl, size = 48 }: Props) {
  const c = useThemeColors();

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  const subSize = size * 0.7;
  const offset = size - subSize;
  const display = members.slice(0, 2);

  if (display.length === 0) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.surfaceElevated,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ fontSize: size * 0.45, color: c.iconMuted }}>👥</Text>
      </View>
    );
  }

  if (display.length === 1) {
    const m = display[0];
    return (
      <View style={{ width: size, height: size }}>
        {m.avatar_url ? (
          <Image
            source={{ uri: m.avatar_url }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        ) : (
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: c.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: c.accentText }}>
              {(m.display_name[0] ?? '?').toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: subSize,
          height: subSize,
          borderRadius: subSize / 2,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: c.bg,
        }}>
        <SubAvatar member={display[0]} size={subSize} />
      </View>
      <View
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: subSize,
          height: subSize,
          borderRadius: subSize / 2,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: c.bg,
          transform: [{ translateX: 0 }, { translateY: 0 }],
          marginLeft: offset,
        }}>
        <SubAvatar member={display[1]} size={subSize} />
      </View>
    </View>
  );
}

function SubAvatar({ member, size }: { member: DbUser; size: number }) {
  const c = useThemeColors();
  if (member.avatar_url) {
    return (
      <Image
        source={{ uri: member.avatar_url }}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: c.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: c.accentText }}>
        {(member.display_name[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}
