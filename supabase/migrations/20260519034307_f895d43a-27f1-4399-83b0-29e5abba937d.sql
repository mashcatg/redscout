
-- Atomic org creation RPC that bypasses RLS but checks auth.uid()
CREATE OR REPLACE FUNCTION public.create_org_with_seed(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _plan text;
  _max_keywords int;
  _max_competitors int;
  _max_orgs int;
  _org_count int;
  _org_id uuid;
  _name text := _payload->>'name';
  _website_url text := _payload->>'website_url';
  _favicon_url text := _payload->>'favicon_url';
  _product_name text := _payload->>'product_name';
  _product_description text := _payload->>'product_description';
  _competitors jsonb := COALESCE(_payload->'competitors', '[]'::jsonb);
  _keywords jsonb := COALESCE(_payload->'keywords', '[]'::jsonb);
  _comp record;
  _kw text;
  _comp_id uuid;
  _kw_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT plan INTO _plan FROM public.users WHERE id = _uid;
  IF _plan IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  SELECT max_keywords, max_competitors, max_orgs
    INTO _max_keywords, _max_competitors, _max_orgs
    FROM public.plan_limits(_plan);

  SELECT COUNT(*) INTO _org_count FROM public.org_members WHERE user_id = _uid;
  IF _org_count >= _max_orgs THEN
    RAISE EXCEPTION 'plan % allows % org(s)', _plan, _max_orgs;
  END IF;
  IF jsonb_array_length(_keywords) > _max_keywords THEN
    RAISE EXCEPTION 'plan % allows % keywords', _plan, _max_keywords;
  END IF;
  IF jsonb_array_length(_competitors) > _max_competitors THEN
    RAISE EXCEPTION 'plan % allows % competitors', _plan, _max_competitors;
  END IF;

  INSERT INTO public.organizations (owner_id, name, website_url, favicon_url, product_name, product_description)
  VALUES (_uid, _name, _website_url, _favicon_url, _product_name, _product_description)
  RETURNING id INTO _org_id;

  INSERT INTO public.org_members (org_id, user_id, role) VALUES (_org_id, _uid, 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;

  FOR _comp IN
    SELECT * FROM jsonb_to_recordset(_competitors) AS x(name text, website_url text, description text)
  LOOP
    INSERT INTO public.competitors (org_id, name, website_url, description)
    VALUES (_org_id, _comp.name, _comp.website_url, _comp.description)
    RETURNING id INTO _comp_id;
    INSERT INTO public.scan_jobs (org_id, job_type, entity_id) VALUES (_org_id, 'competitor_reddit', _comp_id);
  END LOOP;

  FOR _kw IN SELECT jsonb_array_elements_text(_keywords) LOOP
    INSERT INTO public.keywords (org_id, keyword) VALUES (_org_id, _kw) RETURNING id INTO _kw_id;
    INSERT INTO public.scan_jobs (org_id, job_type, entity_id) VALUES (_org_id, 'keyword_reddit', _kw_id);
    INSERT INTO public.scan_jobs (org_id, job_type, entity_id) VALUES (_org_id, 'keyword_serp', _kw_id);
  END LOOP;

  RETURN _org_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_org_with_seed(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_org_with_seed(jsonb) TO authenticated;

-- Dedup inbox items per org
CREATE UNIQUE INDEX IF NOT EXISTS inbox_items_org_post_unique
  ON public.inbox_items (org_id, reddit_post_id);
