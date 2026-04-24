import { redis } from './client';
import {
  STREAK_TTL_SECONDS,
  PRESENCE_TTL_SECONDS,
  STORY_VIEW_THROTTLE_SECONDS,
} from '@constants/config';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DAY_GAP_MS = 20 * 60 * 60 * 1000; 

export interface StreakData {
  count: number;
  userASent: number | null;
  userBSent: number | null;
  lastIncrementedAt: number | null;
}

function sortedPair(uid1: string, uid2: string): [string, string] {
  return uid1 < uid2 ? [uid1, uid2] : [uid2, uid1];
}

function streakKey(uid1: string, uid2: string): string {
  const [a, b] = sortedPair(uid1, uid2);
  return `streak:${a}:${b}`;
}

export async function getStreak(
  uid1: string,
  uid2: string,
): Promise<StreakData | null> {
  const raw = await redis.get<string>(streakKey(uid1, uid2));
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as StreakData);
  } catch {
    return null;
  }
}

export async function getStreakTTL(uid1: string, uid2: string): Promise<number> {
  return redis.ttl(streakKey(uid1, uid2));
}

export async function recordSnapSent(
  senderId: string,
  recipientId: string,
): Promise<StreakData> {
  const key = streakKey(senderId, recipientId);
  const [uidA] = sortedPair(senderId, recipientId);
  const now = Date.now();

  const existing = await getStreak(senderId, recipientId);
  const data: StreakData = existing ?? {
    count: 0,
    userASent: null,
    userBSent: null,
    lastIncrementedAt: null,
  };

  if (senderId === uidA) data.userASent = now;
  else data.userBSent = now;

  if (data.userASent && data.userBSent) {
    const gap = Math.abs(data.userASent - data.userBSent);
    const isMutualExchange = gap <= DAY_MS;

    const newDay =
      !data.lastIncrementedAt ||
      now - data.lastIncrementedAt >= MIN_DAY_GAP_MS;

    if (isMutualExchange && newDay) {
      data.count += 1;
      data.lastIncrementedAt = now;
    }
  }

  await redis.set(key, JSON.stringify(data), { ex: STREAK_TTL_SECONDS });
  return data;
}

export async function resetStreak(uid1: string, uid2: string): Promise<void> {
  await redis.del(streakKey(uid1, uid2));
}


export async function setPresence(userId: string): Promise<void> {
  await redis.set(`presence:${userId}`, Date.now(), { ex: PRESENCE_TTL_SECONDS });
}

export async function getPresence(userId: string): Promise<number | null> {
  const ts = await redis.get<number>(`presence:${userId}`);
  return ts;
}

export async function checkStoryViewThrottle(
  viewerId: string,
  storyId: string,
): Promise<boolean> {
  const key = `throttle:story_view:${viewerId}:${storyId}`;
  const exists = await redis.exists(key);
  if (exists) return false;
  await redis.set(key, '1', { ex: STORY_VIEW_THROTTLE_SECONDS });
  return true;
}
