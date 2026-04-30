-- ============================================================
-- Snapchat Clone — Group Chat Migration
-- Run this once in the Supabase SQL Editor.
-- Adds parallel tables for group chats alongside the existing
-- 1-on-1 conversations / messages tables.
-- ============================================================

-- ---------- group_chats ----------
CREATE TABLE IF NOT EXISTS public.group_chats (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT,
  avatar_url        TEXT,
  created_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  last_message_text TEXT,
  last_message_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER group_chats_updated_at
  BEFORE UPDATE ON public.group_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- group_members ----------
CREATE TABLE IF NOT EXISTS public.group_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notifications TEXT NOT NULL DEFAULT 'all'
                  CHECK (notifications IN ('all','mentions','none')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at       TIMESTAMPTZ,
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user  ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- ---------- group_messages ----------
CREATE TABLE IF NOT EXISTS public.group_messages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id            UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content             TEXT,
  media_url           TEXT,
  type                TEXT NOT NULL DEFAULT 'text'
                        CHECK (type IN ('text','media','system')),
  mentions            UUID[] NOT NULL DEFAULT '{}',
  saved_by            UUID[] NOT NULL DEFAULT '{}',
  reply_to_message_id UUID REFERENCES public.group_messages(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON public.group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender ON public.group_messages(sender_id);
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- ---------- group_message_views ----------
CREATE TABLE IF NOT EXISTS public.group_message_views (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id    UUID NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  screenshot_at TIMESTAMPTZ,
  UNIQUE (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_message_views_user ON public.group_message_views(user_id);
ALTER TABLE public.group_message_views ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Membership predicate (active members only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_active_group_member(_group UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group AND user_id = _user AND left_at IS NULL
  );
$$;

-- "Did this user create this group?" — used by RLS so the group creator can
-- insert the initial batch of membership rows even before their own
-- membership row has been committed.
CREATE OR REPLACE FUNCTION public.is_group_creator(_group UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_chats
    WHERE id = _group AND created_by = _user
  );
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- group_chats
CREATE POLICY "group_chats_select" ON public.group_chats FOR SELECT USING (
  public.is_active_group_member(id, auth.uid())
);
CREATE POLICY "group_chats_insert" ON public.group_chats FOR INSERT WITH CHECK (
  auth.uid() = created_by
);
CREATE POLICY "group_chats_update" ON public.group_chats FOR UPDATE USING (
  public.is_active_group_member(id, auth.uid())
);

-- group_members
CREATE POLICY "group_members_select" ON public.group_members FOR SELECT USING (
  user_id = auth.uid() OR public.is_active_group_member(group_id, auth.uid())
);
CREATE POLICY "group_members_insert" ON public.group_members FOR INSERT WITH CHECK (
  -- Inserter is adding their own membership, OR they are an existing active
  -- member adding someone else, OR they are the group's creator (so the
  -- initial batch of members can land in a single multi-row INSERT).
  user_id = auth.uid()
  OR public.is_active_group_member(group_id, auth.uid())
  OR public.is_group_creator(group_id, auth.uid())
);
CREATE POLICY "group_members_update" ON public.group_members FOR UPDATE USING (
  user_id = auth.uid()
);

-- group_messages
CREATE POLICY "group_messages_select" ON public.group_messages FOR SELECT USING (
  public.is_active_group_member(group_id, auth.uid())
);
CREATE POLICY "group_messages_insert" ON public.group_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND public.is_active_group_member(group_id, auth.uid())
);
CREATE POLICY "group_messages_update" ON public.group_messages FOR UPDATE USING (
  public.is_active_group_member(group_id, auth.uid())
);

-- group_message_views
CREATE POLICY "group_message_views_select" ON public.group_message_views FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_messages m
    WHERE m.id = message_id
      AND public.is_active_group_member(m.group_id, auth.uid())
  )
);
CREATE POLICY "group_message_views_insert" ON public.group_message_views FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
CREATE POLICY "group_message_views_update" ON public.group_message_views FOR UPDATE USING (
  user_id = auth.uid()
);

-- ============================================================
-- Save / unsave a message: maintain the saved_by[] array
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_group_message_save(_message UUID, _save BOOLEAN)
RETURNS public.group_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result public.group_messages;
BEGIN
  IF _save THEN
    UPDATE public.group_messages
       SET saved_by = (
         SELECT ARRAY(SELECT DISTINCT unnest(saved_by || ARRAY[auth.uid()]))
       )
     WHERE id = _message
       AND public.is_active_group_member(group_id, auth.uid())
    RETURNING * INTO result;
  ELSE
    UPDATE public.group_messages
       SET saved_by = array_remove(saved_by, auth.uid())
     WHERE id = _message
       AND public.is_active_group_member(group_id, auth.uid())
    RETURNING * INTO result;
  END IF;

  RETURN result;
END;
$$;

-- ============================================================
-- Realtime publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_message_views;
