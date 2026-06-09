// Client-safe registry. Every prompt the app uses must be listed here so the
// admin UI can render it even if the DB row doesn't exist yet.

export type PromptDef = {
  key: string;
  label: string;
  description: string;
  defaultContent: string;
  variables: string[];
};

export const PROMPT_REGISTRY: PromptDef[] = [
  {
    key: "onboarding.brand_refine",
    label: "Onboarding · brand refinement",
    description: "Polishes the product name + description after the website crawl.",
    variables: ["{{website_url}}", "{{raw_text}}"],
    defaultContent:
      "You refine a SaaS product profile from raw website text.\nReturn JSON {\"product_name\":\"\",\"product_description\":\"\"}. The description must be 1-2 sentences, plain language.",
  },
  {
    key: "keywords.generate",
    label: "Keywords · initial generation (5)",
    description: "Generates the first 5 keywords for a new organization.",
    variables: ["{{product_name}}", "{{product_description}}"],
    defaultContent:
      "Generate exactly 5 short search-intent keywords (1-3 words) for the product below. Return JSON {\"keywords\":[\"...\"]}.\nProduct: {{product_name}} — {{product_description}}",
  },
  {
    key: "seo.hidden_keywords.seed",
    label: "SEO hidden · first-day seed (5)",
    description: "First-day SEO seeding — 5 hidden keywords used to surface Reddit/Google leads.",
    variables: ["{{product_name}}", "{{product_description}}"],
    defaultContent:
      "Return JSON {\"keywords\":[5 short search-intent phrases reddit users would Google to find a tool like '{{product_name}}']}. Each 2-5 words.\nProduct: {{product_description}}",
  },
  {
    key: "seo.hidden_keywords.rotate",
    label: "SEO hidden · daily rotation (1)",
    description: "After day 0, generate 1 NEW non-duplicate keyword every 2 days.",
    variables: ["{{product_name}}", "{{product_description}}", "{{existing_keywords}}"],
    defaultContent:
      "Return JSON {\"keyword\":\"...\"}. Generate ONE new search-intent phrase (2-5 words) reddit users would Google to find a tool like '{{product_name}}'. MUST NOT appear in this list of already-used keywords (case-insensitive):\n{{existing_keywords}}\nProduct: {{product_description}}",
  },
  {
    key: "scoring.relevance",
    label: "Scoring · Reddit post relevance",
    description: "DeepSeek prompt that scores each Reddit/SERP result 0–100.",
    variables: ["{{product_name}}", "{{product_description}}", "{{title}}", "{{body}}"],
    defaultContent:
      "You score Reddit posts for marketing relevance to a product.\n\nProduct: {{product_name}}\nProduct description: {{product_description}}\n\nReddit post title: {{title}}\nReddit post body: {{body}}\n\nReturn JSON {\"score\":<0-100 integer>,\"reason\":\"<short one-sentence reason>\"}.\n- 90-100: perfect match\n- 60-89: strong topical match\n- 30-59: tangential\n- 0-29: irrelevant",
  },
  {
    key: "comment.rules",
    label: "Comments · global rules",
    description: "Hard rules appended to every generated comment.",
    variables: [],
    defaultContent:
      "Hard rules:\n- SHORT. Max 60 words total. 1-3 sentences.\n- Reddit-native voice — no corporate tone, no \"Great point\", no \"Hi OP\", no signoffs\n- No emojis, no em-dashes, no hashtags\n- Plain text only\n- Get straight to the point — no preamble",
  },
  {
    key: "comment.context_extract",
    label: "Comments · context extraction",
    description: "Extracts the exact pain point and situation from a Reddit post before writing the reply.",
    variables: ["{{title}}", "{{body}}"],
    defaultContent:
      "You are preparing context for a Reddit reply generator. Read the post below and extract the specific information needed to write a natural, targeted reply.\n\nPost title: {{title}}\nPost body: {{body}}\n\nExtract and return strictly as JSON:\n- \"core_problem\": The single most specific problem or frustration the author is expressing. One sentence, in plain language.\n- \"current_situation\": What they are currently doing or using that is not working. If not stated, return null.\n- \"desired_outcome\": What they explicitly or implicitly want to achieve.\n- \"tone\": The emotional tone of the post. One word from frustrated, curious, hopeful, overwhelmed, skeptical, neutral.\n- \"subreddit_context\": Any subreddit-specific norms or signals visible in the post that should shape the reply style.\n\nOutput strictly as JSON. Nothing else.",
  },
  {
    key: "comment.tone.helpful",
    label: "Comment tone · Helpful",
    description: "Reply gives one concrete tip.",
    variables: [],
    defaultContent: "Give ONE concrete tip that solves the OP's problem. Max 2 sentences.",
  },
  {
    key: "comment.tone.personal",
    label: "Comment tone · Personal",
    description: "Brief personal experience + takeaway.",
    variables: [],
    defaultContent: "Share a brief personal experience in 1 sentence + 1 sentence takeaway. Max 2 sentences.",
  },
  {
    key: "comment.tone.curious",
    label: "Comment tone · Curious",
    description: "Asks one clarifying question.",
    variables: [],
    defaultContent: "Ask ONE short clarifying question to understand the OP better. Max 1-2 sentences.",
  },
  {
    key: "comment.tone.direct",
    label: "Comment tone · Direct",
    description: "Direct recommendation, no hedging.",
    variables: [],
    defaultContent: "Recommend a solution directly in 1 short sentence. No hedging.",
  },
  {
    key: "comment.tone.friendly",
    label: "Comment tone · Friendly",
    description: "Warm and useful.",
    variables: [],
    defaultContent: "Warm + useful response, max 2 sentences. No fluff.",
  },
  {
    key: "warmup.post",
    label: "Warmup · karma-building post",
    description: "Generates a karma-building Reddit post for a given subreddit (rules strictly followed).",
    variables: ["{{subreddit}}", "{{description}}", "{{rules}}", "{{post_format}}"],
    defaultContent:
      "You are writing a high-engagement, karma-building Reddit post for r/{{subreddit}}. STRICTLY follow the subreddit description and rules below — they are authoritative. Do not promote any product. Do not ask clarifying questions. Do not refuse. Write something that genuinely belongs in this subreddit and would be upvoted by its real members.\n\n=== SUBREDDIT ===\nr/{{subreddit}}\n\n=== DESCRIPTION (what works here) ===\n{{description}}\n\n=== RULES (strict, must obey) ===\n{{rules}}\n\n=== FORMAT ===\n{{post_format}}\n\nReturn ONLY a single JSON object with exactly these keys and nothing else: {\"title\":\"\",\"body\":\"\"}",
  },

];

export function interpolate(template: string, vars: Record<string, string | number | null | undefined>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v == null ? "" : String(v));
  }
  return out;
}
