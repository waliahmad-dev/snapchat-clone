-- ============================================================
-- Snapchat Clone — Supabase PostgreSQL Schema
-- Run this in the Supabase SQL Editor (top to bottom, once)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL CHECK (username ~ '^[a-z0-9._]{3,20}$'),
  display_name  TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50),
  avatar_url    TEXT,
  snap_score    INTEGER NOT NULL DEFAULT 0 CHECK (snap_score >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select" ON public.users FOR SELECT USING (
  auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = id AND blocked_id = auth.uid())
       OR (blocker_id = auth.uid() AND blocked_id = id)
  )
);
CREATE POLICY "users_update" ON public.users FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users_insert" ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile row when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'New User')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- BLOCKS
-- ============================================================
CREATE TABLE public.blocks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks_select"  ON public.blocks FOR SELECT  USING (auth.uid() = blocker_id);
CREATE POLICY "blocks_insert"  ON public.blocks FOR INSERT  WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocks_delete"  ON public.blocks FOR DELETE  USING (auth.uid() = blocker_id);


-- ============================================================
-- FRIENDSHIPS
-- ============================================================
CREATE TABLE public.friendships (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  addressee_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','blocked','declined')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX idx_friendships_status    ON public.friendships(status);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships_select" ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_insert" ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships_update" ON public.friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_delete" ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE public.conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_1   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant_2   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message_id UUID,
  streak_count    INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (
    LEAST(participant_1::text, participant_2::text),
    GREATEST(participant_1::text, participant_2::text)
  ),
  CHECK (participant_1 <> participant_2)
);
CREATE INDEX idx_conversations_p1      ON public.conversations(participant_1);
CREATE INDEX idx_conversations_p2      ON public.conversations(participant_2);
CREATE INDEX idx_conversations_updated ON public.conversations(updated_at DESC);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select" ON public.conversations FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE public.messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content          TEXT,
  media_url        TEXT,
  type             TEXT NOT NULL DEFAULT 'text'
                     CHECK (type IN ('text','snap','media','system')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewed_at        TIMESTAMPTZ,
  saved_by         UUID[] NOT NULL DEFAULT '{}',
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX idx_messages_conv   ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_unseen ON public.messages(viewed_at) WHERE viewed_at IS NULL;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  )
);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  )
);
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  )
);

-- Deferred FK to conversations.last_message_id
ALTER TABLE public.conversations
  ADD CONSTRAINT fk_last_message
  FOREIGN KEY (last_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

-- Save / unsave a message: maintain saved_by[] atomically. SECURITY DEFINER
-- so the caller can only ever add/remove their own auth.uid().
CREATE OR REPLACE FUNCTION public.toggle_message_save(_message UUID, _save BOOLEAN)
RETURNS public.messages LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result public.messages;
BEGIN
  IF _save THEN
    UPDATE public.messages m
       SET saved_by = (
         SELECT ARRAY(SELECT DISTINCT unnest(m.saved_by || ARRAY[auth.uid()]))
       )
     WHERE m.id = _message
       AND EXISTS (
         SELECT 1 FROM public.conversations c
         WHERE c.id = m.conversation_id
           AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
       )
    RETURNING * INTO result;
  ELSE
    UPDATE public.messages m
       SET saved_by = array_remove(m.saved_by, auth.uid())
     WHERE m.id = _message
       AND EXISTS (
         SELECT 1 FROM public.conversations c
         WHERE c.id = m.conversation_id
           AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
       )
    RETURNING * INTO result;
  END IF;
  RETURN result;
END;
$$;


-- ============================================================
-- SNAPS (image-only direct sends)
-- ============================================================
CREATE TABLE public.snaps (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  media_url     TEXT NOT NULL,
  viewed_at     TIMESTAMPTZ,
  saved         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_snaps_recipient ON public.snaps(recipient_id, viewed_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_snaps_sender    ON public.snaps(sender_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_snaps_expires   ON public.snaps(expires_at) WHERE deleted_at IS NULL;
ALTER TABLE public.snaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snaps_select" ON public.snaps FOR SELECT USING (
  (auth.uid() = sender_id OR auth.uid() = recipient_id) AND deleted_at IS NULL
);
CREATE POLICY "snaps_insert" ON public.snaps FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "snaps_update" ON public.snaps FOR UPDATE USING (
  auth.uid() = sender_id OR auth.uid() = recipient_id
);

-- Increment snap score on each snap sent
CREATE OR REPLACE FUNCTION public.increment_snap_score()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users SET snap_score = snap_score + 1 WHERE id = NEW.sender_id;
  UPDATE public.users SET snap_score = snap_score + 1 WHERE id = NEW.recipient_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER snaps_score_increment
  AFTER INSERT ON public.snaps
  FOR EACH ROW EXECUTE FUNCTION public.increment_snap_score();


-- ============================================================
-- STORIES (image-only, 24h lifecycle)
-- ============================================================
CREATE TABLE public.stories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  media_url   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_stories_user    ON public.stories(user_id, created_at DESC);
CREATE INDEX idx_stories_expires ON public.stories(expires_at) WHERE deleted_at IS NULL;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select" ON public.stories FOR SELECT USING (
  deleted_at IS NULL AND expires_at > NOW() AND (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.friendships f WHERE f.status = 'accepted' AND (
        (f.requester_id = auth.uid() AND f.addressee_id = user_id) OR
        (f.addressee_id = auth.uid() AND f.requester_id = user_id)
      )
    )
  )
);
CREATE POLICY "stories_insert" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_update" ON public.stories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "stories_delete" ON public.stories FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- STORY VIEWS
-- ============================================================
CREATE TABLE public.story_views (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id    UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, viewer_id)
);
CREATE INDEX idx_story_views_story  ON public.story_views(story_id);
CREATE INDEX idx_story_views_viewer ON public.story_views(viewer_id);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_views_select" ON public.story_views FOR SELECT USING (
  auth.uid() = viewer_id OR EXISTS (
    SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid()
  )
);
CREATE POLICY "story_views_insert" ON public.story_views FOR INSERT
  WITH CHECK (auth.uid() = viewer_id);


-- ============================================================
-- MEMORIES
-- ============================================================
CREATE TABLE public.memories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  media_url     TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'camera'
                  CHECK (source IN ('camera','saved_snap','saved_story','import')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_memories_user ON public.memories(user_id, created_at DESC);
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memories_select" ON public.memories FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "memories_insert" ON public.memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memories_update" ON public.memories FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "memories_delete" ON public.memories FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- REALTIME — enable subscriptions on key tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.snaps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;


-- ============================================================
-- CLEANUP — call via pg_cron or Supabase Edge Function schedule
-- Example cron: SELECT cron.schedule('expire-content', '0 * * * *', 'SELECT public.delete_expired_content()');
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_expired_content()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.snaps SET deleted_at = NOW()
  WHERE expires_at < NOW() AND deleted_at IS NULL AND saved = FALSE;

  UPDATE public.stories SET deleted_at = NOW()
  WHERE expires_at < NOW() AND deleted_at IS NULL;
END;
$$;


-- ============================================================
-- STORAGE BUCKETS
-- Create these via the Supabase Dashboard > Storage > New Bucket:
--
-- Name: snaps     | Private | Max file size: 50MB  | Allowed MIME: image/*
-- Name: memories  | Private | Max file size: 100MB | Allowed MIME: image/*
-- Name: stories   | Private | Max file size: 50MB  | Allowed MIME: image/*
-- Name: profiles  | Public  | Max file size: 5MB   | Allowed MIME: image/*
--
-- Storage RLS (set in Dashboard > Storage > Policies):
-- snaps:    SELECT — sender_id = auth.uid() OR recipient_id = auth.uid() (via metadata)
-- memories: All ops — bucket owner only
-- stories:  SELECT — owner or accepted friend; INSERT — owner only
-- profiles: SELECT public; INSERT/UPDATE — auth.uid() = path prefix
-- ============================================================
