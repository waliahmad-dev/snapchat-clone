-- ============================================================
-- Hotfix: chat_presence still references the dropped messages.saved
-- column.
--
-- The error `column m.saved does not exist` from the chat_presence_set
-- outbox job means either set_chat_presence itself or a trigger fired
-- by it is reading the legacy boolean. This script:
--   1. Reports anything in the public schema that still references
--      `m.saved`, so you can see the offender.
--   2. Forcibly drops + recreates set_chat_presence with the new
--      saved_by[] predicate.
--   3. Drops any trigger on chat_presence whose function references
--      the legacy `saved` column (common cleanup-trigger pattern).
--
-- Run the entire file in the Supabase SQL Editor.
-- ============================================================

-- ---------- 1. Diagnostic: list functions referencing the legacy column ----------
DO $$
DECLARE
  r RECORD;
  found INT := 0;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, p.proname AS function_name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND pg_get_functiondef(p.oid) ~* '\m(m\.saved|messages\.saved)\M'
       AND pg_get_functiondef(p.oid) !~* 'saved_by'
  LOOP
    RAISE NOTICE 'Function still references legacy `saved`: %.%', r.schema, r.function_name;
    found := found + 1;
  END LOOP;
  IF found = 0 THEN
    RAISE NOTICE 'No public function references the legacy saved column. Good.';
  END IF;
END $$;

-- ---------- 2. Forcibly recreate set_chat_presence ----------
-- CASCADE so any view/trigger that depends on the old definition is
-- removed cleanly. We rebuild what we need below.
DROP FUNCTION IF EXISTS public.set_chat_presence(UUID, BOOLEAN) CASCADE;

CREATE TABLE IF NOT EXISTS public.chat_presence (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  in_chat         BOOLEAN NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_presence_select" ON public.chat_presence;
CREATE POLICY "chat_presence_select" ON public.chat_presence FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.set_chat_presence(_conversation UUID, _in_chat BOOLEAN)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  any_present BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.chat_presence (conversation_id, user_id, in_chat, updated_at)
  VALUES (_conversation, auth.uid(), _in_chat, NOW())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET in_chat = EXCLUDED.in_chat, updated_at = NOW();

  IF NOT _in_chat THEN
    SELECT EXISTS (
      SELECT 1 FROM public.chat_presence cp
      WHERE cp.conversation_id = _conversation
        AND cp.in_chat = TRUE
    ) INTO any_present;

    IF NOT any_present THEN
      UPDATE public.messages m
         SET deleted_at = NOW()
       WHERE m.conversation_id = _conversation
         AND m.deleted_at IS NULL
         AND m.viewed_at IS NOT NULL
         AND m.type IN ('text','snap','media')
         AND cardinality(m.saved_by) = 0;
    END IF;
  END IF;
END;
$$;

-- ---------- 3. Drop any trigger on chat_presence whose function still references m.saved ----------
-- Triggers are the most common second source of this error: a function
-- attached AFTER UPDATE on chat_presence runs the cleanup with the old
-- predicate. Find and drop them.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname  AS trigger_name,
           t.tgrelid::regclass::text AS table_name,
           p.proname AS function_name
      FROM pg_trigger t
      JOIN pg_class    c ON c.oid = t.tgrelid
      JOIN pg_proc     p ON p.oid = t.tgfoid
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE NOT t.tgisinternal
       AND n.nspname = 'public'
       AND c.relname IN ('chat_presence','messages')
       AND pg_get_functiondef(p.oid) ~* '\m(m\.saved|messages\.saved)\M'
       AND pg_get_functiondef(p.oid) !~* 'saved_by'
  LOOP
    RAISE NOTICE 'Dropping stale trigger %.% (function %)', r.table_name, r.trigger_name, r.function_name;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', r.trigger_name, r.table_name);
    -- Don't drop the function — it may be used elsewhere or you may want
    -- to inspect/fix it manually. Just unhook the trigger.
  END LOOP;
END $$;

-- ============================================================
-- After running, retry the action that triggered chat_presence_set in
-- the app. If you still see the error, the diagnostic at step 1 will
-- have logged the offending function — paste its NOTICE output back to
-- me and I'll patch it.
-- ============================================================
