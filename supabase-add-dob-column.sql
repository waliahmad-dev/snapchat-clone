-- Adds date_of_birth to public.users so the profile screen can show
-- birthday + horoscope pills. Safe to re-run.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;
