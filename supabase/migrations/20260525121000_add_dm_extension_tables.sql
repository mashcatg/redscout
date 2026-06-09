CREATE TABLE IF NOT EXISTS public.dm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subreddit text,
  target_username text,
  message_template text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  queued_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dm_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.dm_campaigns(id) ON DELETE SET NULL,
  reddit_username text NOT NULL,
  subreddit text,
  reddit_url text,
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_campaigns_org_user_created_at
  ON public.dm_campaigns (org_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dm_message_logs_org_user_created_at
  ON public.dm_message_logs (org_id, user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_dm_campaigns_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dm_campaigns_updated ON public.dm_campaigns;
CREATE TRIGGER trg_dm_campaigns_updated
BEFORE UPDATE ON public.dm_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_dm_campaigns_updated_at();

ALTER TABLE public.dm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_message_logs ENABLE ROW LEVEL SECURITY;

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