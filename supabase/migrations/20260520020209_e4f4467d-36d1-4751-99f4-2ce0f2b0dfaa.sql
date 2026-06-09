
-- 1) Inbox dedupe: prevent same reddit_url repeating per org
CREATE UNIQUE INDEX IF NOT EXISTS inbox_items_org_reddit_url_uniq
  ON public.inbox_items (org_id, reddit_url)
  WHERE reddit_url IS NOT NULL;

-- 2) SEO hidden keywords: dedupe + insert/update permissions for owning org members
CREATE UNIQUE INDEX IF NOT EXISTS seo_hidden_keywords_org_keyword_uniq
  ON public.seo_hidden_keywords (org_id, lower(keyword));

ALTER TABLE public.seo_hidden_keywords ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

DROP POLICY IF EXISTS seo_hidden_insert ON public.seo_hidden_keywords;
CREATE POLICY seo_hidden_insert ON public.seo_hidden_keywords
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id, auth.uid()));

DROP POLICY IF EXISTS seo_hidden_update ON public.seo_hidden_keywords;
CREATE POLICY seo_hidden_update ON public.seo_hidden_keywords
  FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_org_member(org_id, auth.uid()));

-- 3) SEO rotation schedule per org
CREATE TABLE IF NOT EXISTS public.seo_keyword_schedule (
  org_id uuid PRIMARY KEY,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  seeded boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_keyword_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seo_sched_select ON public.seo_keyword_schedule;
CREATE POLICY seo_sched_select ON public.seo_keyword_schedule
  FOR SELECT TO authenticated USING (public.is_org_member(org_id, auth.uid()));

-- 4) Inbox bulk save/archive helpers (saved_at already exists; add archived_at for clarity)
ALTER TABLE public.inbox_items ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 5) Admin write policies for warmup_scans (already exist for warmup_subreddits)
DROP POLICY IF EXISTS warmup_scans_admin_insert ON public.warmup_scans;
CREATE POLICY warmup_scans_admin_insert ON public.warmup_scans
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS warmup_scans_admin_delete ON public.warmup_scans;
CREATE POLICY warmup_scans_admin_delete ON public.warmup_scans
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
