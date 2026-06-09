
ALTER TYPE public.inbox_status ADD VALUE IF NOT EXISTS 'archived';

ALTER TABLE public.inbox_items
  ADD COLUMN IF NOT EXISTS hidden_keyword_id uuid;

CREATE TABLE IF NOT EXISTS public.seo_hidden_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  generation_round int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seo_hidden_keywords_org_idx ON public.seo_hidden_keywords(org_id);
ALTER TABLE public.seo_hidden_keywords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_hidden_select" ON public.seo_hidden_keywords;
CREATE POLICY "seo_hidden_select" ON public.seo_hidden_keywords
  FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

INSERT INTO public.admin_prompts (key, label, content) VALUES
  ('onboarding.brand_refine', 'Onboarding · brand refine',
   'You refine raw scraped website data into a clean brand profile. Return JSON: { "name": string, "product_name": string, "product_description": string (max 280 chars, 2-3 sentences, plain). Never invent facts.'),
  ('keywords.generate', 'Keywords · generate (visible)',
   'Generate 10 short, high-intent Reddit search keywords for the brand below. 2-4 words each. Focus on problems users discuss, not brand names. Return JSON: { "keywords": string[] }'),
  ('seo.hidden_keywords.generate', 'SEO · hidden keywords (auto)',
   'Generate 5 fresh long-tail SEO keywords likely to surface relevant Reddit threads on Google for the brand below. 3-6 words each. NEVER repeat any keyword in the EXCLUDE list. Return JSON: { "keywords": string[] }'),
  ('scoring.relevance', 'Post relevance scoring',
   'Score 0-100 how relevant this Reddit post is for the brand. Consider intent and topical match. Return JSON: { "score": number, "reason": string (max 120 chars) }. 90-100 perfect, 60-89 strong, 30-59 tangential, 0-29 irrelevant.'),
  ('tone.helpful', 'Tone · helpful',
   'Give ONE concrete tip that solves the OP''s problem. Max 2 sentences.'),
  ('tone.personal', 'Tone · personal',
   'Share a brief personal experience in 1 sentence + 1 sentence takeaway. Max 2 sentences.'),
  ('tone.curious', 'Tone · curious',
   'Ask ONE short clarifying question to understand the OP better. Max 1-2 sentences.'),
  ('tone.direct', 'Tone · direct',
   'Recommend a solution directly in 1 short sentence. No hedging.'),
  ('tone.friendly', 'Tone · friendly',
   'Warm + useful response, max 2 sentences. No fluff.'),
  ('comment.rules', 'Comment · global rules',
   'Hard rules:
- SHORT. Max 60 words total. 1-3 sentences.
- Reddit-native voice — no corporate tone, no "Great point", no "Hi OP", no signoffs
- No emojis, no em-dashes, no hashtags
- Plain text only
- Get straight to the point — no preamble'),
  ('warmup.post', 'Warmup · karma post',
   'Generate ONE highly engaging karma-building Reddit post for the subreddit. STRICTLY follow the subreddit''s rules below. Output JSON: { "title": string (max 280), "body": string (max 4000) }. Reddit-native voice, no signoffs, no emojis.')
ON CONFLICT (key) DO NOTHING;
