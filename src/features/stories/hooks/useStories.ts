import { useEffect, useId, useState } from 'react';
import { supabase } from '@lib/supabase/client';
import { useAuthStore } from '@features/auth/store/authStore';
import { useStoriesStore } from '@features/stories/store/storiesStore';
import { checkStoryViewThrottle } from '@lib/redis/streak';
import type { DbStory, DbUser, DbStoryView } from '@/types/database';

export interface StoryGroup {
  user: DbUser;
  stories: (DbStory & { story_views: DbStoryView[] })[];
  hasUnviewed: boolean;
}

export function useStories() {
  const profile = useAuthStore((s) => s.profile);
  const instanceId = useId();
  const lastPostedAt = useStoriesStore((s) => s.lastPostedAt);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    loadStories();

    const sub = supabase
      .channel(`stories:feed:${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stories' },
        () => loadStories()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stories' },
        () => loadStories()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'story_views' },
        () => loadStories()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [profile?.id, instanceId]);

  useEffect(() => {
    if (!profile || lastPostedAt === 0) return;
    loadStories();
  }, [lastPostedAt, profile?.id]);

  async function loadStories() {
    if (!profile) return;
    setLoading(true);
    try {
      const res = await supabase
        .from('stories')
        .select('*, story_views(*)')
        .order('created_at', { ascending: false });
      const stories = res.data;

      if (!stories) return;

      const userIds = [...new Set(stories.map((s: DbStory) => s.user_id))];

      const { data: users } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds);

      const userMap = new Map((users ?? []).map((u: DbUser) => [u.id, u]));

      const groups = new Map<string, typeof stories>();
      for (const story of stories) {
        if (!groups.has(story.user_id)) groups.set(story.user_id, []);
        groups.get(story.user_id)!.push(story);
      }

      const result: StoryGroup[] = [];
      for (const [userId, userStories] of groups) {
        const user = userMap.get(userId);
        if (!user) continue;

        const hasUnviewed = userStories.some(
          (s) => !s.story_views?.some((v: DbStoryView) => v.viewer_id === profile.id)
        );

        result.push({ user, stories: userStories, hasUnviewed });
      }

      result.sort((a, b) => {
        if (a.user.id === profile.id) return -1;
        if (b.user.id === profile.id) return 1;
        if (a.hasUnviewed && !b.hasUnviewed) return -1;
        if (!a.hasUnviewed && b.hasUnviewed) return 1;
        return 0;
      });

      setStoryGroups(result);
    } catch {
      // offline — keep last known story feed
    } finally {
      setLoading(false);
    }
  }

  async function recordView(storyId: string) {
    if (!profile) return;
    try {
      const allowed = await checkStoryViewThrottle(profile.id, storyId);
      if (!allowed) return;

      await supabase.from('story_views').upsert({
        story_id: storyId,
        viewer_id: profile.id,
      });
    } catch {
      // offline — view will fail silently; not user-actionable
    }
  }

  return { storyGroups, loading, recordView, refresh: loadStories };
}
