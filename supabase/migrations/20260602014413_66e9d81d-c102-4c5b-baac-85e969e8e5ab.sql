
-- 1. Allow users to read their own api_call_logs
CREATE POLICY "api_call_logs_self_select" ON public.api_call_logs
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 2. Restrict scan_jobs writes (insert/update/delete) to service role only;
--    keep org member SELECT access.
DROP POLICY IF EXISTS jobs_all ON public.scan_jobs;

CREATE POLICY "jobs_member_select" ON public.scan_jobs
FOR SELECT TO authenticated
USING (is_org_member(org_id, auth.uid()));

-- 3. Lock down SECURITY DEFINER functions: revoke EXECUTE from anon/public.
REVOKE EXECUTE ON FUNCTION public.create_org_with_seed(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_scan_jobs(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_next_dm_lead(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_dm_campaign(uuid, uuid, text, text, text, text, text, text, text, boolean, boolean, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_org_with_seed(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scan_jobs(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_org(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_dm_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_dm_campaign(uuid, uuid, text, text, text, text, text, text, text, boolean, boolean, boolean) TO authenticated;

-- 4. Set a fixed search_path on the two trigger functions that don't have one.
CREATE OR REPLACE FUNCTION public.update_dm_campaigns_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_dm_leads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
