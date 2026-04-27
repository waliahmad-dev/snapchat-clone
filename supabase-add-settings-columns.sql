-- ============================================================
-- Settings: phone column + username change history
-- Run after supabase-schema.sql and supabase-add-dob-column.sql
-- ============================================================

-- Phone number (display-only, no SMS verification).
-- E.164-ish: optional leading +, 7–15 digits.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_phone_format;
ALTER TABLE public.users
  ADD CONSTRAINT users_phone_format
  CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{7,15}$');

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
  ON public.users (phone) WHERE phone IS NOT NULL;


-- Username change history — used to enforce "3 changes per rolling year".
CREATE TABLE IF NOT EXISTS public.username_changes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  old_username TEXT NOT NULL,
  new_username TEXT NOT NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_username_changes_user_time
  ON public.username_changes (user_id, changed_at DESC);

ALTER TABLE public.username_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "username_changes_select_own" ON public.username_changes;
CREATE POLICY "username_changes_select_own" ON public.username_changes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "username_changes_insert_own" ON public.username_changes;
CREATE POLICY "username_changes_insert_own" ON public.username_changes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
