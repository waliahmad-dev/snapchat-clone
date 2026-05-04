-- ============================================================
-- Snapchat Clone — Group Chat: idempotent policy + helper reset.
--
-- Run this once in the Supabase SQL editor. It is safe to re-run.
-- It assumes the four tables already exist (created by
-- supabase-add-groups.sql). It drops and recreates every group-
-- related RLS policy + helper function so the final state is
-- guaranteed regardless of what's currently installed.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Make sure RLS is enabled on every group table.
-- ------------------------------------------------------------
ALTER TABLE public.group_chats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_message_views ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER so they can read past RLS).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_group_member(_group UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group AND user_id = _user AND left_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_creator(_group UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_chats
    WHERE id = _group AND created_by = _user
  );
$$;

-- ------------------------------------------------------------
-- 3. group_chats policies.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "group_chats_select" ON public.group_chats;
DROP POLICY IF EXISTS "group_chats_insert" ON public.group_chats;
DROP POLICY IF EXISTS "group_chats_update" ON public.group_chats;

CREATE POLICY "group_chats_select" ON public.group_chats FOR SELECT USING (
  public.is_active_group_member(id, auth.uid())
  OR auth.uid() = created_by
);

CREATE POLICY "group_chats_insert" ON public.group_chats FOR INSERT WITH CHECK (
  auth.uid() = created_by
);

CREATE POLICY "group_chats_update" ON public.group_chats FOR UPDATE USING (
  public.is_active_group_member(id, auth.uid())
);

-- ------------------------------------------------------------
-- 4. group_members policies.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
DROP POLICY IF EXISTS "group_members_update" ON public.group_members;

CREATE POLICY "group_members_select" ON public.group_members FOR SELECT USING (
  user_id = auth.uid()
  OR public.is_active_group_member(group_id, auth.uid())
);

CREATE POLICY "group_members_insert" ON public.group_members FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR public.is_active_group_member(group_id, auth.uid())
  OR public.is_group_creator(group_id, auth.uid())
);

CREATE POLICY "group_members_update" ON public.group_members FOR UPDATE USING (
  user_id = auth.uid()
);

-- ------------------------------------------------------------
-- 5. group_messages policies.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "group_messages_select" ON public.group_messages;
DROP POLICY IF EXISTS "group_messages_insert" ON public.group_messages;
DROP POLICY IF EXISTS "group_messages_update" ON public.group_messages;

CREATE POLICY "group_messages_select" ON public.group_messages FOR SELECT USING (
  public.is_active_group_member(group_id, auth.uid())
);

CREATE POLICY "group_messages_insert" ON public.group_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND public.is_active_group_member(group_id, auth.uid())
);

CREATE POLICY "group_messages_update" ON public.group_messages FOR UPDATE USING (
  public.is_active_group_member(group_id, auth.uid())
);

-- ------------------------------------------------------------
-- 6. group_message_views policies.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "group_message_views_select" ON public.group_message_views;
DROP POLICY IF EXISTS "group_message_views_insert" ON public.group_message_views;
DROP POLICY IF EXISTS "group_message_views_update" ON public.group_message_views;

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

-- ------------------------------------------------------------
-- 6.b. Re-join RPC: re-add a member who previously left.
--
-- A row with the same (group_id, user_id) already exists with left_at
-- set, so a plain INSERT hits the UNIQUE constraint and is skipped, and
-- a plain UPDATE is blocked by group_members_update RLS (only the row's
-- own user can update it). Bypass via SECURITY DEFINER, but enforce that
-- the caller is an active member or the group's creator.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rejoin_group_member(_group UUID, _user UUID)
RETURNS public.group_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.group_members;
BEGIN
  IF NOT (
    public.is_active_group_member(_group, auth.uid())
    OR public.is_group_creator(_group, auth.uid())
  ) THEN
    RAISE EXCEPTION 'not authorized to add members to this group';
  END IF;

  UPDATE public.group_members
     SET left_at  = NULL,
         joined_at = NOW()
   WHERE group_id = _group AND user_id = _user
  RETURNING * INTO result;

  IF FOUND THEN
    RETURN result;
  END IF;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (_group, _user)
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- ------------------------------------------------------------
-- 7. Save / unsave RPC (needed by the GROUP_MESSAGE_SAVE outbox handler).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_group_message_save(_message UUID, _save BOOLEAN)
RETURNS public.group_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

-- ------------------------------------------------------------
-- 8. Cleanup orphan group_chats rows (groups with zero memberships
-- left behind by the previous broken state). Skips the alias form
-- that some Supabase versions reject.
-- ------------------------------------------------------------
DELETE FROM public.group_chats
WHERE id NOT IN (SELECT group_id FROM public.group_members);

-- ------------------------------------------------------------
-- 8.b. Storage RLS for group-snap media.
--
-- The existing snaps bucket policies only let the sender read their
-- own files, or the recipient listed in public.snaps. Group snaps
-- aren't in public.snaps; they live in public.group_messages and have
-- no single recipient. Without this policy, every non-sender group
-- member sees "Snap couldn't load" because Storage denies the signed-
-- URL request. Allow active group members to read both the full and
-- _thumb variants of any file referenced by a non-deleted group
-- message in a group they belong to.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "snaps_group_member_select" ON storage.objects;

CREATE POLICY "snaps_group_member_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'snaps'
  AND EXISTS (
    SELECT 1 FROM public.group_messages gm
    WHERE gm.deleted_at IS NULL
      AND public.is_active_group_member(gm.group_id, auth.uid())
      AND (
        gm.media_url = storage.objects.name
        OR gm.media_url = replace(storage.objects.name, '_thumb.', '_full.')
      )
  )
);

-- ------------------------------------------------------------
-- 9. Sanity-check query — paste the result back if anything is missing.
-- ------------------------------------------------------------
SELECT polname
FROM pg_policy
WHERE polrelid IN (
  'public.group_chats'::regclass,
  'public.group_members'::regclass,
  'public.group_messages'::regclass,
  'public.group_message_views'::regclass
)
ORDER BY polname;
