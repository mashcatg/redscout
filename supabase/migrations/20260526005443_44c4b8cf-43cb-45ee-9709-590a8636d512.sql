
-- Indexes for fast dedupe lookups and worker queue pulls
CREATE INDEX IF NOT EXISTS idx_dm_message_logs_org_user_status
  ON public.dm_message_logs (org_id, reddit_username, status);

CREATE INDEX IF NOT EXISTS idx_dm_leads_campaign_status
  ON public.dm_leads (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_dm_leads_org_user
  ON public.dm_leads (org_id, reddit_username);

-- Atomic claim of the next pending lead (prevents double-send across tabs)
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
  IF NOT public.is_org_member(_org, auth.uid()) THEN
    RAISE EXCEPTION 'not a member of org';
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
