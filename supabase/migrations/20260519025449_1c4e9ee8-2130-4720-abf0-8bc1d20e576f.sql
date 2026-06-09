
-- ============ ENUMS ============
CREATE TYPE plan_type AS ENUM ('starter', 'growth', 'agency');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE job_type_enum AS ENUM ('keyword_serp', 'keyword_reddit', 'competitor_reddit');
CREATE TYPE job_status AS ENUM ('pending', 'running', 'done', 'failed');
CREATE TYPE inbox_status AS ENUM ('new', 'saved', 'replied', 'dismissed');

-- ============ TABLES ============
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  plan plan_type NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website_url TEXT,
  favicon_url TEXT,
  product_name TEXT,
  product_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE public.keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'proximity',
  is_paused BOOLEAN NOT NULL DEFAULT false,
  last_serp_scan_at TIMESTAMPTZ,
  last_reddit_scan_at TIMESTAMPTZ,
  next_serp_scan_at TIMESTAMPTZ,
  next_reddit_scan_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website_url TEXT,
  description TEXT,
  last_reddit_scan_at TIMESTAMPTZ,
  next_reddit_scan_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_type job_type_enum NOT NULL,
  entity_id UUID NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scan_jobs_claim ON public.scan_jobs (org_id, status, next_run_at);

CREATE TABLE public.inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  reddit_post_id TEXT NOT NULL,
  reddit_url TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  subreddit TEXT,
  author TEXT,
  upvotes INTEGER DEFAULT 0,
  num_comments INTEGER DEFAULT 0,
  upvote_ratio NUMERIC,
  reddit_created_at TIMESTAMPTZ,
  google_position INTEGER,
  serp_keyword TEXT,
  keyword_id UUID REFERENCES public.keywords(id) ON DELETE SET NULL,
  competitor_id UUID REFERENCES public.competitors(id) ON DELETE SET NULL,
  relevance_score INTEGER,
  score_reason TEXT,
  status inbox_status NOT NULL DEFAULT 'new',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, reddit_post_id)
);
CREATE INDEX idx_inbox_items_org_source ON public.inbox_items (org_id, source, relevance_score DESC);

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUTH TRIGGERS ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, plan)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN NEW.email = 'mashcatg@gmail.com' THEN 'agency'::plan_type ELSE 'starter'::plan_type END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_org_created
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- ============ HELPER ============
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = _org_id AND user_id = _user_id);
$$;

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.claim_scan_jobs(
  _org_id UUID, _limit INT DEFAULT 20, _running_timeout_minutes INT DEFAULT 5
)
RETURNS TABLE (id UUID, job_type job_type_enum, entity_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_org_member(_org_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a member of org';
  END IF;
  RETURN QUERY
  WITH claimed AS (
    SELECT j.id FROM public.scan_jobs j
    WHERE j.org_id = _org_id
      AND (
        j.status = 'pending'
        OR (j.status = 'running' AND j.last_run_at < now() - (_running_timeout_minutes || ' minutes')::interval)
      )
      AND j.next_run_at <= now()
    ORDER BY j.created_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.scan_jobs sj
  SET status = 'running', last_run_at = now(), error_message = NULL
  FROM claimed
  WHERE sj.id = claimed.id
  RETURNING sj.id, sj.job_type, sj.entity_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.plan_limits(_plan TEXT)
RETURNS TABLE (max_keywords INT, max_competitors INT, max_orgs INT)
LANGUAGE SQL IMMUTABLE AS $$
  SELECT
    CASE _plan WHEN 'starter' THEN 10 WHEN 'growth' THEN 30 WHEN 'agency' THEN 50 ELSE 10 END,
    CASE _plan WHEN 'starter' THEN 3 WHEN 'growth' THEN 9 WHEN 'agency' THEN 15 ELSE 3 END,
    CASE _plan WHEN 'starter' THEN 1 WHEN 'growth' THEN 3 WHEN 'agency' THEN 999 ELSE 1 END;
$$;

-- ============ RLS ============
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

-- users: self only
CREATE POLICY "users_self_select" ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_self_update" ON public.users FOR UPDATE USING (id = auth.uid());

-- organizations: members can read; owner can mutate
CREATE POLICY "orgs_member_select" ON public.organizations FOR SELECT
  USING (public.is_org_member(id, auth.uid()));
CREATE POLICY "orgs_owner_insert" ON public.organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "orgs_owner_update" ON public.organizations FOR UPDATE
  USING (owner_id = auth.uid());
CREATE POLICY "orgs_owner_delete" ON public.organizations FOR DELETE
  USING (owner_id = auth.uid());

-- org_members: members of the same org can read; user can read self rows
CREATE POLICY "members_self_select" ON public.org_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_org_member(org_id, auth.uid()));
CREATE POLICY "members_owner_insert" ON public.org_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "members_owner_delete" ON public.org_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid()));

-- keywords / competitors / scan_jobs / inbox_items: org-scoped all
CREATE POLICY "kw_all" ON public.keywords FOR ALL
  USING (public.is_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "comp_all" ON public.competitors FOR ALL
  USING (public.is_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "jobs_all" ON public.scan_jobs FOR ALL
  USING (public.is_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "inbox_all" ON public.inbox_items FOR ALL
  USING (public.is_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_org_member(org_id, auth.uid()));
