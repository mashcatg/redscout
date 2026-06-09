-- Make DM campaigns/leads accessible to org owners as well as org members.
-- This is a forward-only fix for databases that already applied the original DM tables migration.

CREATE OR REPLACE FUNCTION public.can_access_org(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = _org_id
      AND (o.owner_id = _user_id OR public.is_org_member(_org_id, _user_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_next_dm_lead(_campaign_id uuid)
RETURNS TABLE (
  id uuid,
  reddit_username text,
  comment_id text,
  comment_url text,
  comment_body text,
  post_title text,
  post_url text,
  subreddit text,
  is_first_level boolean,
  org_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
BEGIN
  SELECT c.org_id INTO _org FROM public.dm_campaigns c WHERE c.id = _campaign_id;
  IF _org IS NULL THEN
    RAISE EXCEPTION 'campaign not found';
  END IF;
  IF NOT public.can_access_org(_org, auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  WITH next_lead AS (
    SELECT l.id
    FROM public.dm_leads l
    WHERE l.campaign_id = _campaign_id
      AND l.status = 'pending'
      AND l.skipped = false
    ORDER BY l.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.dm_leads dl
  SET status = 'in_progress', updated_at = now()
  FROM next_lead
  WHERE dl.id = next_lead.id
  RETURNING dl.id, dl.reddit_username, dl.comment_id, dl.comment_url,
            dl.comment_body, dl.post_title, dl.post_url, dl.subreddit,
            dl.is_first_level, dl.org_id;
END;
$$;

ALTER TABLE public.dm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dm_campaigns_select" ON public.dm_campaigns;
DROP POLICY IF EXISTS "dm_campaigns_insert" ON public.dm_campaigns;
DROP POLICY IF EXISTS "dm_campaigns_update" ON public.dm_campaigns;
DROP POLICY IF EXISTS "dm_campaigns_delete" ON public.dm_campaigns;

CREATE POLICY "dm_campaigns_select" ON public.dm_campaigns
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()));

CREATE POLICY "dm_campaigns_insert" ON public.dm_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()));

CREATE POLICY "dm_campaigns_update" ON public.dm_campaigns
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()));

CREATE POLICY "dm_campaigns_delete" ON public.dm_campaigns
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()));

DROP POLICY IF EXISTS "dm_logs_select" ON public.dm_message_logs;
DROP POLICY IF EXISTS "dm_logs_insert" ON public.dm_message_logs;
DROP POLICY IF EXISTS "dm_logs_update" ON public.dm_message_logs;
DROP POLICY IF EXISTS "dm_logs_delete" ON public.dm_message_logs;

CREATE POLICY "dm_logs_select" ON public.dm_message_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()));

CREATE POLICY "dm_logs_insert" ON public.dm_message_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()));

CREATE POLICY "dm_logs_update" ON public.dm_message_logs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()));

CREATE POLICY "dm_logs_delete" ON public.dm_message_logs
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()));

DROP POLICY IF EXISTS "dm_leads_select" ON public.dm_leads;
DROP POLICY IF EXISTS "dm_leads_insert" ON public.dm_leads;
DROP POLICY IF EXISTS "dm_leads_update" ON public.dm_leads;
DROP POLICY IF EXISTS "dm_leads_delete" ON public.dm_leads;

CREATE POLICY "dm_leads_select" ON public.dm_leads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()));

CREATE POLICY "dm_leads_insert" ON public.dm_leads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()));

CREATE POLICY "dm_leads_update" ON public.dm_leads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()));

CREATE POLICY "dm_leads_delete" ON public.dm_leads
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.can_access_org(org_id, auth.uid()));
