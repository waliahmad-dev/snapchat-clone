-- ═════════════════════════════════════════════════════════════════════════
-- Add reply-to-message support
-- Run this ONCE in the Supabase SQL Editor.
--
-- Adds a nullable FK on messages so a message can quote another message.
-- The existing messages_access RLS policy already covers all operations
-- against this table so no new policy is needed.
-- ═════════════════════════════════════════════════════════════════════════

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID
  REFERENCES public.messages(id) ON DELETE SET NULL;

-- Index helps the client join to the referenced row when rendering a thread
CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON public.messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;
