-- ============================================================
-- SAHAYAK: Fix RLS Recursion and Creator Join Request Visibility
-- Database: Supabase PostgreSQL
-- ============================================================

-- 1. Create Safe SECURITY DEFINER Helper Functions
-- These functions run with the privileges of the function creator (admin),
-- executing queries to group_members and group_schemes WITHOUT triggering RLS,
-- thereby completely preventing infinite recursion (Postgres error 42P17).

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = _user_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_creator(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = _user_id
      AND role = 'creator'
      AND status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM public.group_schemes
    WHERE id = _group_id
      AND creator_user_id = _user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.is_group_creator(UUID, UUID) TO authenticated, service_role, anon;

-- ============================================================
-- 2. Fix RLS on public.group_members
-- ============================================================
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Anyone authenticated can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Members and creators can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can join groups or creators can add members" ON public.group_members;
DROP POLICY IF EXISTS "Users can join or creators can add members" ON public.group_members;
DROP POLICY IF EXISTS "Users can update own membership" ON public.group_members;
DROP POLICY IF EXISTS "Users and creators can update membership" ON public.group_members;
DROP POLICY IF EXISTS "Users or creators can update membership" ON public.group_members;
DROP POLICY IF EXISTS "Users and creators can remove members" ON public.group_members;
DROP POLICY IF EXISTS "Users or creators can remove members" ON public.group_members;

-- SELECT: A user can see their own row directly, or see members of groups they belong to/created
CREATE POLICY "Members and creators can view group members"
ON public.group_members FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_group_member(group_id, auth.uid())
  OR public.is_group_creator(group_id, auth.uid())
);

-- INSERT: User can join or group creator can add accepted members
CREATE POLICY "Users can join or creators can add members"
ON public.group_members FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.is_group_creator(group_id, auth.uid())
);

-- UPDATE: User can update own record or creator can update member role/status
CREATE POLICY "Users or creators can update membership"
ON public.group_members FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_group_creator(group_id, auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR public.is_group_creator(group_id, auth.uid())
);

-- DELETE: User can leave or creator can remove members
CREATE POLICY "Users or creators can remove members"
ON public.group_members FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_group_creator(group_id, auth.uid())
);

-- ============================================================
-- 3. Fix RLS on public.join_requests
-- ============================================================
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requesters and group creators can view join requests" ON public.join_requests;
DROP POLICY IF EXISTS "Users can create their own join requests" ON public.join_requests;
DROP POLICY IF EXISTS "Group creators and requesters can update join requests" ON public.join_requests;
DROP POLICY IF EXISTS "Requesters can delete own join requests" ON public.join_requests;

-- SELECT: Requester can view own requests; Creator can view requests for their group
CREATE POLICY "Requesters and group creators can view join requests"
ON public.join_requests FOR SELECT TO authenticated
USING (
  auth.uid() = requester_id
  OR public.is_group_creator(group_id, auth.uid())
);

-- INSERT: Authenticated user can submit a join request for themselves
CREATE POLICY "Users can create their own join requests"
ON public.join_requests FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = requester_id
);

-- UPDATE: Creator can accept/decline; Requester can update (e.g. request again)
CREATE POLICY "Group creators and requesters can update join requests"
ON public.join_requests FOR UPDATE TO authenticated
USING (
  auth.uid() = requester_id
  OR public.is_group_creator(group_id, auth.uid())
)
WITH CHECK (
  auth.uid() = requester_id
  OR public.is_group_creator(group_id, auth.uid())
);

-- DELETE: Requester can cancel own request
CREATE POLICY "Requesters can delete own join requests"
ON public.join_requests FOR DELETE TO authenticated
USING (
  auth.uid() = requester_id
);

-- ============================================================
-- 4. Fix RLS on public.messages
-- ============================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view own 1-to-1 or group messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send 1-to-1 or group messages" ON public.messages;
DROP POLICY IF EXISTS "Receivers can update messages" ON public.messages;

-- SELECT: 1-to-1 for participants; Group messages for active group members or creator
CREATE POLICY "Users can view own 1-to-1 or group messages"
ON public.messages FOR SELECT TO authenticated
USING (
  (group_id IS NULL AND (auth.uid() = sender_id OR auth.uid() = receiver_id))
  OR
  (group_id IS NOT NULL AND (
    public.is_group_member(group_id, auth.uid())
    OR public.is_group_creator(group_id, auth.uid())
  ))
);

-- INSERT: 1-to-1 sender; Group message requires sender to be active member or creator
CREATE POLICY "Users can send 1-to-1 or group messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND (
    (group_id IS NULL AND receiver_id IS NOT NULL)
    OR
    (group_id IS NOT NULL AND (
      public.is_group_member(group_id, auth.uid())
      OR public.is_group_creator(group_id, auth.uid())
    ))
  )
);

CREATE POLICY "Receivers can update messages"
ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = receiver_id);

-- ============================================================
-- 5. Fix RLS on public.notifications
-- Allows users/system to notify other users of join requests / group updates
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);

-- ============================================================
-- 6. Fix RLS on public.group_schemes
-- Allows anyone to view forming groups, plus members/creators can view ready/applied groups
-- ============================================================
ALTER TABLE public.group_schemes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view forming groups" ON public.group_schemes;
DROP POLICY IF EXISTS "Anyone can view forming or joined groups" ON public.group_schemes;

CREATE POLICY "Anyone can view forming or joined groups"
ON public.group_schemes FOR SELECT
USING (
  status = 'forming' 
  OR creator_user_id = auth.uid() 
  OR public.is_group_member(id, auth.uid())
);

-- ============================================================
-- 7. Permissions & Schema Reload
-- ============================================================
GRANT ALL ON TABLE public.join_requests TO authenticated, service_role;
GRANT ALL ON TABLE public.group_members TO authenticated, service_role;
GRANT ALL ON TABLE public.group_schemes TO authenticated, service_role;
GRANT ALL ON TABLE public.messages TO authenticated, service_role;
GRANT ALL ON TABLE public.notifications TO authenticated, service_role;

-- Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';

