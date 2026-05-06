ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS saved_by UUID[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'saved'
  ) THEN
    UPDATE public.messages m
       SET saved_by = ARRAY[c.participant_1, c.participant_2]
      FROM public.conversations c
     WHERE m.conversation_id = c.id
       AND m.saved = TRUE
       AND cardinality(m.saved_by) = 0;
  END IF;
END $$;

ALTER TABLE public.messages
  DROP COLUMN IF EXISTS saved;

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
