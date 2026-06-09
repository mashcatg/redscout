-- 1. Fix privilege escalation: only owners can insert org_members
DROP POLICY IF EXISTS members_owner_insert ON public.org_members;
CREATE POLICY members_owner_insert
ON public.org_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_members.org_id AND o.owner_id = auth.uid()
  )
);

-- 2. Add UPDATE policy: only owners can update memberships (prevents role escalation)
DROP POLICY IF EXISTS members_owner_update ON public.org_members;
CREATE POLICY members_owner_update
ON public.org_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_members.org_id AND o.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_members.org_id AND o.owner_id = auth.uid()
  )
);

-- 3. Revoke EXECUTE on trigger-only SECURITY DEFINER functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_organization() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- 4. Restrict claim_scan_jobs to authenticated only (not anon)
REVOKE EXECUTE ON FUNCTION public.claim_scan_jobs(uuid, integer, integer) FROM anon, public;

-- 5. is_org_member must remain executable for RLS policies that reference it
--    (no change needed; keep accessible to authenticated)