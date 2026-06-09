-- Create DM campaigns through a security-definer RPC so the extension does not
-- rely on direct client-side inserts into a row-level-secured table.

CREATE OR REPLACE FUNCTION public.create_dm_campaign(
  _org_id uuid,
  _user_id uuid,
  _name text,
  _message_template text,
  _status text DEFAULT 'draft',
  _post_title text DEFAULT NULL,
  _post_url text DEFAULT NULL,
  _post_author text DEFAULT NULL,
  _post_subreddit text DEFAULT NULL,
  _skip_post_author boolean DEFAULT true,
  _skip_if_dmed boolean DEFAULT true,
  _first_level_only boolean DEFAULT true
)
RETURNS public.dm_campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _campaign public.dm_campaigns;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'user mismatch';
  END IF;

  IF NOT public.can_access_org(_org_id, auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  INSERT INTO public.dm_campaigns (
    org_id,
    user_id,
    name,
    message_template,
    status,
    post_title,
    post_url,
    post_author,
    post_subreddit,
    skip_post_author,
    skip_if_dmed,
    first_level_only
  )
  VALUES (
    _org_id,
    _user_id,
    _name,
    _message_template,
    _status,
    _post_title,
    _post_url,
    _post_author,
    _post_subreddit,
    _skip_post_author,
    _skip_if_dmed,
    _first_level_only
  )
  RETURNING * INTO _campaign;

  RETURN _campaign;
END;
$$;
