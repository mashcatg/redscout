
-- Warmup admin subreddits
CREATE TABLE public.warmup_subreddits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  rules text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.warmup_subreddits ENABLE ROW LEVEL SECURITY;
CREATE POLICY warmup_sub_select_auth ON public.warmup_subreddits FOR SELECT TO authenticated USING (true);
CREATE POLICY warmup_sub_admin_insert ON public.warmup_subreddits FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY warmup_sub_admin_update ON public.warmup_subreddits FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY warmup_sub_admin_delete ON public.warmup_subreddits FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Daily scan cache for each subreddit
CREATE TABLE public.warmup_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subreddit_id uuid NOT NULL REFERENCES public.warmup_subreddits(id) ON DELETE CASCADE,
  posts jsonb NOT NULL DEFAULT '[]'::jsonb,
  credits_used int DEFAULT 0,
  scanned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX warmup_scans_sub_idx ON public.warmup_scans(subreddit_id, scanned_at DESC);
ALTER TABLE public.warmup_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY warmup_scans_select_auth ON public.warmup_scans FOR SELECT TO authenticated USING (true);

-- User selections (per-org, max 5 enforced in fn)
CREATE TABLE public.user_warmup_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid NOT NULL,
  subreddit_id uuid NOT NULL REFERENCES public.warmup_subreddits(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, subreddit_id)
);
ALTER TABLE public.user_warmup_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY uws_select ON public.user_warmup_selections FOR SELECT TO authenticated USING (user_id = auth.uid() AND is_org_member(org_id, auth.uid()));
CREATE POLICY uws_insert ON public.user_warmup_selections FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND is_org_member(org_id, auth.uid()));
CREATE POLICY uws_delete ON public.user_warmup_selections FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER warmup_sub_updated BEFORE UPDATE ON public.warmup_subreddits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
