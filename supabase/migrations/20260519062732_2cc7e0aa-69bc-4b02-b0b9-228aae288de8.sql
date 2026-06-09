
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS training_notes text;

CREATE TABLE IF NOT EXISTS public.comment_personalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  slug text NOT NULL,
  label text NOT NULL,
  description text,
  instructions text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);
ALTER TABLE public.comment_personalities ENABLE ROW LEVEL SECURITY;
CREATE POLICY personalities_all ON public.comment_personalities
  FOR ALL USING (public.is_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_org_member(org_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.admin_prompts (
  key text PRIMARY KEY,
  label text NOT NULL,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.admin_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_prompts_select ON public.admin_prompts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY admin_prompts_insert ON public.admin_prompts
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY admin_prompts_update ON public.admin_prompts
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY admin_prompts_delete ON public.admin_prompts
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.admin_prompts (key, label, content) VALUES
  ('tone.helpful', 'Tone: Helpful', 'Give ONE concrete tip that solves the OP''s problem. Max 2 sentences.'),
  ('tone.personal', 'Tone: Personal', 'Share a brief personal experience in 1 sentence + 1 sentence takeaway. Max 2 sentences.'),
  ('tone.curious', 'Tone: Curious', 'Ask ONE short clarifying question to understand the OP better. Max 1-2 sentences.'),
  ('tone.direct', 'Tone: Direct', 'Recommend a solution directly in 1 short sentence. No hedging.'),
  ('tone.friendly', 'Tone: Friendly', 'Warm + useful response, max 2 sentences. No fluff.'),
  ('comment.rules', 'Comment hard rules', 'Hard rules:
- SHORT. Max 60 words total. 1-3 sentences.
- Reddit-native voice — no corporate tone, no "Great point", no "Hi OP", no signoffs
- No emojis, no em-dashes, no hashtags
- Plain text only
- Get straight to the point — no preamble')
ON CONFLICT (key) DO NOTHING;
