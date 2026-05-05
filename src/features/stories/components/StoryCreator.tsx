import React, { useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@features/auth/store/authStore';
import { enqueueJob } from '@lib/offline/outboxRunner';
import { JOB, type StoryPostJob } from '@lib/offline/jobs';
import { persistMedia } from '@lib/offline/persistMedia';
import { uuid } from '@lib/offline/uuid';

interface Props {
  capturedUri: string;
  onDone: () => void;
  onCancel: () => void;
}

export function StoryCreator({ capturedUri, onDone, onCancel }: Props) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const [posting, setPosting] = useState(false);

  async function postStory() {
    if (!profile) return;
    setPosting(true);
    try {
      const storyId = uuid();
      const persistedUri = await persistMedia(capturedUri, `story_${storyId}.jpg`);
      const storagePath = `${profile.id}/${storyId}.jpg`;

      const job: StoryPostJob = {
        storyId,
        userId: profile.id,
        imageUri: persistedUri,
        storagePath,
      };

      await enqueueJob({
        kind: JOB.STORY_POST,
        payload: job,
        groupKey: `story:${storyId}`,
      });
      onDone();
    } catch (err) {
      Alert.alert(
        t('stories.creator.queueFailedTitle'),
        err instanceof Error ? err.message : t('common.tryAgain'),
      );
    } finally {
      setPosting(false);
    }
  }

  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-black/60 rounded-2xl mx-4">
      <Text className="text-white font-semibold">{t('stories.creator.addToMyStory')}</Text>
      <View className="flex-row gap-3">
        <Pressable onPress={onCancel} disabled={posting} className="px-4 py-2 rounded-full bg-white/10">
          <Text className="text-white text-sm font-semibold">{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          onPress={postStory}
          disabled={posting}
          className="px-4 py-2 rounded-full bg-snap-yellow">
          {posting ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text className="text-black text-sm font-bold">{t('stories.creator.post')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
