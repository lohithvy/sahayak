-- ============================================================
-- SAHAYAK: Fix Group Members Recursion, Add Join Requests, 
-- and Support Group Messaging
-- ============================================================

-- 1. Fix infinite recursion in group_members RLS
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Anyone authenticated can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can join groups or creators can add members" ON public.group_members;
DROP POLICY IF EXISTS "Users can update own membership" ON public.group_members;
DROP POLICY IF EXISTS "Users and creators can update membership" ON public.group_members;
DROP POLICY IF EXISTS "Users and creators can remove members" ON public.group_members;

CREATE POLICY "Anyone authenticated can view group members" 
ON public.group_members FOR SELECT TO authenticated 
USING (true);

CREATE POLICY "Users can join groups or creators can add members" 
ON public.group_members FOR INSERT TO authenticated 
WITH CHECK (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.group_schemes gs 
    WHERE gs.id = group_members.group_id AND gs.creator_user_id = auth.uid()
  )
);

CREATE POLICY "Users and creators can update membership" 
ON public.group_members FOR UPDATE TO authenticated 
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.group_schemes gs 
    WHERE gs.id = group_members.group_id AND gs.creator_user_id = auth.uid()
  )
);

CREATE POLICY "Users and creators can remove members" 
ON public.group_members FOR DELETE TO authenticated 
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.group_schemes gs 
    WHERE gs.id = group_members.group_id AND gs.creator_user_id = auth.uid()
  )
);

-- Make scheme_id optional so entrepreneurs can create general collectives
ALTER TABLE public.group_schemes ALTER COLUMN scheme_id DROP NOT NULL;

-- 2. Create join_requests table
CREATE TABLE IF NOT EXISTS public.join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.group_schemes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, accepted, declined, cancelled
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requesters and group creators can view join requests" ON public.join_requests;
DROP POLICY IF EXISTS "Users can create their own join requests" ON public.join_requests;
DROP POLICY IF EXISTS "Group creators and requesters can update join requests" ON public.join_requests;
DROP POLICY IF EXISTS "Requesters can delete own join requests" ON public.join_requests;

CREATE POLICY "Requesters and group creators can view join requests"
ON public.join_requests FOR SELECT TO authenticated
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.group_schemes gs 
    WHERE gs.id = join_requests.group_id AND gs.creator_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own join requests"
ON public.join_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Group creators and requesters can update join requests"
ON public.join_requests FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.group_schemes gs 
    WHERE gs.id = join_requests.group_id AND gs.creator_user_id = auth.uid()
  )
);

CREATE POLICY "Requesters can delete own join requests"
ON public.join_requests FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 3. Upgrade messages table to support Group Chat
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.group_schemes(id) ON DELETE CASCADE;
ALTER TABLE public.messages ALTER COLUMN receiver_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON public.messages(group_id);

DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view own 1-to-1 or group messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send 1-to-1 or group messages" ON public.messages;

CREATE POLICY "Users can view own 1-to-1 or group messages"
ON public.messages FOR SELECT TO authenticated
USING (
  -- 1-to-1 messages
  (group_id IS NULL AND (auth.uid() = sender_id OR auth.uid() = receiver_id))
  OR
  -- Group messages (members of group or creator)
  (group_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.group_members gm 
      WHERE gm.group_id = messages.group_id 
        AND gm.user_id = auth.uid() 
        AND gm.status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.group_schemes gs 
      WHERE gs.id = messages.group_id 
        AND gs.creator_user_id = auth.uid()
    )
  ))
);

CREATE POLICY "Users can send 1-to-1 or group messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND (
    (group_id IS NULL AND receiver_id IS NOT NULL)
    OR
    (group_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.group_members gm 
        WHERE gm.group_id = messages.group_id 
          AND gm.user_id = auth.uid() 
          AND gm.status = 'active'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.group_schemes gs 
        WHERE gs.id = messages.group_id 
          AND gs.creator_user_id = auth.uid()
      )
    ))
  )
);

-- 4. Safe Public Group Profiles enhancements
ALTER TABLE public.public_group_profiles ADD COLUMN IF NOT EXISTS public_id TEXT;

-- 5. Permissions
GRANT ALL ON TABLE public.join_requests TO authenticated, service_role;
GRANT ALL ON TABLE public.group_members TO authenticated, service_role;
GRANT ALL ON TABLE public.group_schemes TO authenticated, service_role;
GRANT ALL ON TABLE public.waiting_list TO authenticated, service_role;
GRANT ALL ON TABLE public.public_group_profiles TO authenticated, service_role;
GRANT ALL ON TABLE public.messages TO authenticated, service_role;
GRANT ALL ON TABLE public.notifications TO authenticated, service_role;

-- 6. Realtime publications
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.join_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_schemes;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
