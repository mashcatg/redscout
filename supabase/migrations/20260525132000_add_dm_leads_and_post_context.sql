ALTER TABLE public.dm_campaigns
  ADD COLUMN IF NOT EXISTS post_title text,
  ADD COLUMN IF NOT EXISTS post_url text,
  ADD COLUMN IF NOT EXISTS post_author text,
  ADD COLUMN IF NOT EXISTS post_subreddit text,
  ADD COLUMN IF NOT EXISTS post_body text,
  ADD COLUMN IF NOT EXISTS first_level_only boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS skip_post_author boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS skip_if_dmed boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.dm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.dm_campaigns(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reddit_username text NOT NULL,
  comment_id text,
  comment_body text,
  comment_url text,
  post_title text,
  post_url text,
  subreddit text,
  status text NOT NULL DEFAULT 'DM Sent',
  note text,
  is_first_level boolean NOT NULL DEFAULT true,
  skipped boolean NOT NULL DEFAULT false,
  contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_leads_unique
  ON public.dm_leads (campaign_id, reddit_username, COALESCE(comment_id, ''));

CREATE INDEX IF NOT EXISTS idx_dm_leads_campaign_created_at
  ON public.dm_leads (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dm_leads_org_user_created_at
  ON public.dm_leads (org_id, user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_dm_leads_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dm_leads_updated ON public.dm_leads;
CREATE TRIGGER trg_dm_leads_updated
BEFORE UPDATE ON public.dm_leads
FOR EACH ROW EXECUTE FUNCTION public.update_dm_leads_updated_at();

ALTER TABLE public.dm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_leads_select" ON public.dm_leads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(org_id, auth.uid()));

CREATE POLICY "dm_leads_insert" ON public.dm_leads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id, auth.uid()));

CREATE POLICY "dm_leads_update" ON public.dm_leads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(org_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id, auth.uid()));

CREATE POLICY "dm_leads_delete" ON public.dm_leads
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(org_id, auth.uid()));