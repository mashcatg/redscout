
INSERT INTO public.admin_prompts (key, label, content) VALUES
('onboarding.brand_refine','Onboarding — brand name & description (DeepSeek)','You are a brand analyst. Given the scraped homepage of a SaaS/product website, return JSON {"name":"<short brand name, 1-3 words, NO tagline>","description":"<2-3 sentence plain description of what the product does and who its for>"} only. Be concise. Use the company name only, no slogans.'),
('onboarding.keywords','Onboarding — keyword generation','Generate 10 SEO/Reddit search keywords (3-5 words each) that potential customers of this product would type when looking for a solution. Avoid brand names. Return one keyword per line.'),
('onboarding.competitors','Onboarding — competitor discovery','List the top 5 direct competitor product names with their websites. Return JSON array [{"name":"","website_url":"","description":""}].'),
('comment.rules','Comment generation — global rules',E'Hard rules:\n- SHORT. Max 60 words total. 1-3 sentences.\n- Reddit-native voice — no corporate tone, no "Great point", no "Hi OP", no signoffs\n- No emojis, no em-dashes, no hashtags\n- Plain text only\n- Get straight to the point — no preamble'),
('tone.helpful','Tone — helpful','Give ONE concrete tip that solves the OPs problem. Max 2 sentences.'),
('tone.personal','Tone — personal','Share a brief personal experience in 1 sentence + 1 sentence takeaway. Max 2 sentences.'),
('tone.curious','Tone — curious','Ask ONE short clarifying question to understand the OP better. Max 1-2 sentences.'),
('tone.direct','Tone — direct','Recommend a solution directly in 1 short sentence. No hedging.'),
('tone.friendly','Tone — friendly','Warm + useful response, max 2 sentences. No fluff.'),
('warmup.post','Warmup — karma-building post generation','You are writing a high-engagement, karma-building Reddit post for the chosen subreddit. STRICTLY follow the subreddit rules provided. Write a post that genuinely contributes value to the community — share an authentic story, a useful insight, or a thought-provoking question. NEVER promote a product. Return JSON {"title":"","body":""}. Title 8-15 words. Body 100-250 words. Plain text, no markdown, no emojis.'),
('scoring.relevance','Inbox item — relevance scoring','Score 0-100 how relevant this Reddit post is to the product. Consider: does the OP have a problem this product solves? Is it a buying-intent question? Return JSON {"score":<0-100>,"reason":"<1 short sentence>"}.')
ON CONFLICT (key) DO NOTHING;
