-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS + RLS for Snapchat clone
-- ───────────────────────────────────────────────────────────────────────────
-- HOW TO USE:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. Verify in Storage tab that 4 buckets exist: snaps, stories, memories, profiles
--
-- This script is idempotent — safe to re-run if policies get out of sync.
--
-- COMMON CAUSE OF "new row violates row-level security policy":
--   • The 4 storage buckets don't exist  →  this script creates them
--   • Bucket-level RLS policies missing  →  this script adds them
--   • Table-level policies missing       →  the end of this script adds
--     conversations_insert + memories_insert in case they weren't in the
--     original schema
--
-- Path convention used by the app (all uploads):
--   {bucket}/{user_id}/{timestamp}_variant.jpg
-- First folder segment IS the user id — that's what the RLS policy checks.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. CREATE STORAGE BUCKETS ──────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('snaps',    'snaps',    false),
  ('stories',  'stories',  false),
  ('memories', 'memories', false),
  ('profiles', 'profiles', true)   -- avatars are world-readable
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;


-- ── 2. STORAGE OBJECT POLICIES ─────────────────────────────────────────────
-- Drop any prior attempts so re-running is safe
DROP POLICY IF EXISTS "snaps_owner_insert"     ON storage.objects;
DROP POLICY IF EXISTS "snaps_owner_select"     ON storage.objects;
DROP POLICY IF EXISTS "snaps_recipient_select" ON storage.objects;
DROP POLICY IF EXISTS "snaps_owner_delete"     ON storage.objects;

DROP POLICY IF EXISTS "stories_owner_insert"    ON storage.objects;
DROP POLICY IF EXISTS "stories_friends_select"  ON storage.objects;
DROP POLICY IF EXISTS "stories_owner_delete"    ON storage.objects;

DROP POLICY IF EXISTS "memories_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "memories_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "memories_owner_delete" ON storage.objects;

DROP POLICY IF EXISTS "profiles_owner_insert"  ON storage.objects;
DROP POLICY IF EXISTS "profiles_owner_update"  ON storage.objects;
DROP POLICY IF EXISTS "profiles_public_select" ON storage.objects;
DROP POLICY IF EXISTS "profiles_owner_delete"  ON storage.objects;


-- ── snaps ─────────────────────────────────────────────────────────────────
CREATE POLICY "snaps_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'snaps'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "snaps_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'snaps'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "snaps_recipient_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'snaps'
  AND EXISTS (
    SELECT 1 FROM public.snaps s
    WHERE s.media_url = storage.objects.name
      AND s.recipient_id = auth.uid()
      AND s.deleted_at IS NULL
  )
);

CREATE POLICY "snaps_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'snaps'
  AND auth.uid()::text = (storage.foldername(name))[1]
);


-- ── stories ───────────────────────────────────────────────────────────────
CREATE POLICY "stories_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'stories'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "stories_friends_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'stories'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]   -- own story
    OR EXISTS (
      SELECT 1 FROM public.stories st
      WHERE st.media_url = storage.objects.name
        AND st.deleted_at IS NULL
        AND st.expires_at > NOW()
        AND (
          st.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.friendships f
            WHERE f.status = 'accepted'
              AND (
                (f.requester_id = auth.uid() AND f.addressee_id = st.user_id)
                OR (f.addressee_id = auth.uid() AND f.requester_id = st.user_id)
              )
          )
        )
    )
  )
);

CREATE POLICY "stories_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'stories'
  AND auth.uid()::text = (storage.foldername(name))[1]
);


-- ── memories (private to owner) ───────────────────────────────────────────
CREATE POLICY "memories_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'memories'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "memories_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'memories'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "memories_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'memories'
  AND auth.uid()::text = (storage.foldername(name))[1]
);


-- ── profiles (public avatars) ─────────────────────────────────────────────
CREATE POLICY "profiles_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profiles'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "profiles_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profiles'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "profiles_public_select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'profiles');

CREATE POLICY "profiles_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profiles'
  AND auth.uid()::text = (storage.foldername(name))[1]
);


-- ── 3. TABLE POLICIES THE ORIGINAL SCHEMA MAY HAVE MISSED ─────────────────
-- conversations: explicit INSERT policy (the schema has a generic USING
-- policy that doesn't cover INSERT)
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = participant_1 OR auth.uid() = participant_2
);

-- memories table: INSERT + SELECT (in case schema had the "FOR ALL" bug)
DROP POLICY IF EXISTS "memories_insert" ON public.memories;
CREATE POLICY "memories_insert"
ON public.memories FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "memories_select" ON public.memories;
CREATE POLICY "memories_select"
ON public.memories FOR SELECT TO authenticated
USING (auth.uid() = user_id AND deleted_at IS NULL);


-- ── 4. VERIFY ─────────────────────────────────────────────────────────────
-- After running this, these queries should return rows:
--   SELECT id, name, public FROM storage.buckets ORDER BY id;
--   SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY policyname;
