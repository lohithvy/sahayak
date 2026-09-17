-- ============================================================
-- SAHAYAK MULTILINGUAL MESSAGING SYSTEM MIGRATION
-- Enables profile-based translation, per-recipient group translations,
-- and secure cross-user preferred language lookup.
-- ============================================================

-- 1. SECURE HELPER FUNCTION: Get single user's preferred language
-- SECURITY DEFINER allows querying preferred_language without exposing
-- sensitive financial, category, or personal profile fields.
CREATE OR REPLACE FUNCTION public.get_user_preferred_language(_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lang TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN 'en';
  END IF;

  SELECT preferred_language INTO _lang
  FROM public.profiles
  WHERE user_id = _user_id;

  -- Fallback to public_group_profiles if not in profiles
  IF _lang IS NULL THEN
    SELECT language INTO _lang
    FROM public.public_group_profiles
    WHERE user_id = _user_id;
  END IF;

  RETURN COALESCE(_lang, 'en');
END;
$$;

-- 2. SECURE HELPER FUNCTION: Get multiple users' preferred languages (batch)
CREATE OR REPLACE FUNCTION public.get_users_preferred_languages(_user_ids UUID[])
RETURNS TABLE(user_id UUID, preferred_language TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p_id AS user_id,
    COALESCE(
      (SELECT p.preferred_language FROM public.profiles p WHERE p.user_id = p_id),
      (SELECT pgp.language FROM public.public_group_profiles pgp WHERE pgp.user_id = p_id),
      'en'
    ) AS preferred_language
  FROM unnest(_user_ids) AS p_id;
END;
$$;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.get_user_preferred_language(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_users_preferred_languages(UUID[]) TO authenticated, anon, service_role;

-- 3. SCHEMA COMPATIBILITY: Make receiver_id nullable for group messages
ALTER TABLE public.messages ALTER COLUMN receiver_id DROP NOT NULL;

-- 4. PER-RECIPIENT TRANSLATIONS TABLE: message_translations
-- Stores translations per (message_id, target_language) so group chats
-- can support members with multiple different languages without overwriting
-- the canonical original message.
CREATE TABLE IF NOT EXISTS public.message_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  target_language TEXT NOT NULL,
  translated_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT message_translations_msg_lang_key UNIQUE(message_id, target_language)
);

-- Index for instant lookup by message and target language
CREATE INDEX IF NOT EXISTS idx_message_translations_lookup 
ON public.message_translations(message_id, target_language);

-- Enable RLS on message_translations
ALTER TABLE public.message_translations ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist to avoid duplicate policy errors
DROP POLICY IF EXISTS "Users can view translations for accessible messages" ON public.message_translations;
DROP POLICY IF EXISTS "Authenticated users can insert translations" ON public.message_translations;
DROP POLICY IF EXISTS "Authenticated users can update translations" ON public.message_translations;

-- SELECT policy: A user can view a translation if they have access to the underlying message
CREATE POLICY "Users can view translations for accessible messages"
ON public.message_translations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_translations.message_id
    AND (
      -- 1-to-1 conversation participant
      m.sender_id = auth.uid()
      OR m.receiver_id = auth.uid()
      -- Or member of the group
      OR (
        m.group_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = m.group_id
          AND gm.user_id = auth.uid()
        )
      )
    )
  )
);

-- INSERT policy: Authenticated users can insert translations
CREATE POLICY "Authenticated users can insert translations"
ON public.message_translations FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- UPDATE policy: Authenticated users can update translations
CREATE POLICY "Authenticated users can update translations"
ON public.message_translations FOR UPDATE
USING (auth.role() = 'authenticated');

-- Grants on message_translations
GRANT ALL ON TABLE public.message_translations TO authenticated, service_role;
GRANT SELECT ON TABLE public.message_translations TO anon;

-- 4. ENSURE TRANSLATIONS CACHE HAS CORRECT PERMISSIONS
ALTER TABLE public.translations_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read translations" ON public.translations_cache;
DROP POLICY IF EXISTS "Anyone can cache translations" ON public.translations_cache;
DROP POLICY IF EXISTS "Authenticated users can cache translations" ON public.translations_cache;

CREATE POLICY "Anyone can read translations" 
ON public.translations_cache FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can cache translations" 
ON public.translations_cache FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

GRANT ALL ON TABLE public.translations_cache TO authenticated, service_role;
GRANT SELECT ON TABLE public.translations_cache TO anon;

-- 5. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
