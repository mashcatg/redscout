CREATE TABLE IF NOT EXISTS public.warmup_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid NOT NULL,
  subreddit_id uuid NOT NULL,
  post_id text NOT NULL,
  status text NOT NULL DEFAULT 'engaged',
  engaged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subreddit_id, post_id)
);

ALTER TABLE public.warmup_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warmup_eng_select" ON public.warmup_engagements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(org_id, auth.uid()));

CREATE POLICY "warmup_eng_insert" ON public.warmup_engagements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id, auth.uid()));

CREATE POLICY "warmup_eng_update" ON public.warmup_engagements
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "warmup_eng_delete" ON public.warmup_engagements
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS warmup_eng_user_idx ON public.warmup_engagements(user_id, org_id);