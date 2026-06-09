import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordApiCall, type ApiCallContext } from "./api-logging";

type JobType = "keyword_reddit" | "keyword_serp" | "competitor_reddit" | "competitor_serp";

const CADENCE_MS: Record<JobType, number> = {
  keyword_reddit: 24 * 60 * 60 * 1000, // 1 day
  competitor_reddit: 5 * 24 * 60 * 60 * 1000, // 5 days
  keyword_serp: 10 * 24 * 60 * 60 * 1000, // 10 days
  competitor_serp: 10 * 24 * 60 * 60 * 1000, // 10 days
};

type RedditPost = {
  reddit_post_id: string;
  reddit_url: string;
  title: string;
  body: string | null;
  author: string | null;
  subreddit: string | null;
  num_comments: number;
  upvotes: number;
  upvote_ratio: number | null;
  reddit_created_at: string | null;
};

type ApiCallResult<T> = { ok: true; data: T; status: number } | { ok: false; error: string; status: number };

function uniqueByRedditPostId<T extends { reddit_post_id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = String(row.reddit_post_id ?? "").trim().toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

async function sociavaultRedditSearch(query: string, logContext: ApiCallContext): Promise<ApiCallResult<RedditPost[]>> {
  const key = process.env.SOCIAVAULT_API_KEY;
  const url = `https://api.sociavault.com/v1/scrape/reddit/search?query=${encodeURIComponent(query)}&sort=relevance&timeframe=day&trim=false`;
  if (!key) {
    await recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: logContext.orgId ?? null,
      api_platform: "sociavault",
      feature: "scan",
      operation: "reddit_search",
      endpoint: url,
      ok: false,
      status_code: 0,
      latency_ms: 0,
      error_message: "SOCIAVAULT_API_KEY not set",
      request_meta: { query },
    });
    return { ok: false, error: "SOCIAVAULT_API_KEY not set", status: 0 };
  }
  const startedAt = Date.now();
  const res = await fetch(url, { headers: { "X-API-Key": key } });
  const text = await res.text();
  if (!res.ok) {
    const quotaError = res.status === 402 ? "Sociavault quota exhausted (402)" : `Sociavault ${res.status}: ${text.slice(0, 200)}`;
    await recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: logContext.orgId ?? null,
      api_platform: "sociavault",
      feature: "scan",
      operation: "reddit_search",
      endpoint: url,
      ok: false,
      status_code: res.status,
      latency_ms: Date.now() - startedAt,
      error_message: quotaError,
      request_meta: { query },
      response_meta: { body_preview: text.slice(0, 500) },
    });
    return { ok: false, error: quotaError, status: res.status };
  }
  let json: { success?: boolean; data?: { posts?: Record<string, Record<string, unknown>> | Array<Record<string, unknown>> } };
  try {
    json = JSON.parse(text);
  } catch {
    await recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: logContext.orgId ?? null,
      api_platform: "sociavault",
      feature: "scan",
      operation: "reddit_search",
      endpoint: url,
      ok: false,
      status_code: res.status,
      latency_ms: Date.now() - startedAt,
      error_message: `Sociavault parse error: ${text.slice(0, 200)}`,
      request_meta: { query },
      response_meta: { body_preview: text.slice(0, 500) },
    });
    return { ok: false, error: `Sociavault parse error: ${text.slice(0, 200)}`, status: res.status };
  }
  const postsRaw = json.data?.posts ?? {};
  const arr = Array.isArray(postsRaw) ? postsRaw : Object.values(postsRaw);
  const posts = arr.map((p) => {
    const permalink = p.permalink ? String(p.permalink) : "";
    const rawUrl = String(p.url ?? "");
    const isRedirect = /^https?:\/\/(?:v|i)\.redd\.it\//i.test(rawUrl);
    const finalUrl = permalink
      ? `https://www.reddit.com${permalink.startsWith("/") ? "" : "/"}${permalink}`
      : rawUrl;
    return {
      reddit_post_id: String(p.id ?? p.name ?? ""),
      reddit_url: isRedirect && permalink ? finalUrl : (finalUrl || rawUrl),
      title: String(p.title ?? ""),
      body: extractRedditBody(p),
      author: (p.author ?? null) as string | null,
      subreddit: (p.subreddit ?? null) as string | null,
      num_comments: Number(p.num_comments ?? 0),
      upvotes: Number(p.score ?? p.ups ?? 0),
      upvote_ratio: p.upvote_ratio == null ? null : Number(p.upvote_ratio),
      reddit_created_at:
        p.created_utc != null
          ? new Date(Number(p.created_utc) * 1000).toISOString()
          : ((p.created ?? null) as string | null),
    };
  }).filter((p) => p.reddit_post_id && p.reddit_url && p.title);
  const dedupedPosts = uniqueByRedditPostId(posts);
  void recordApiCall(logContext.supabase, {
    user_id: logContext.userId,
    org_id: logContext.orgId ?? null,
    api_platform: "sociavault",
    feature: "scan",
    operation: "reddit_search",
    endpoint: url,
    ok: true,
    status_code: res.status,
    latency_ms: Date.now() - startedAt,
    request_meta: { query },
    response_meta: { posts: dedupedPosts.length, response_bytes: text.length },
  });
  return { ok: true, data: dedupedPosts, status: res.status };
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function htmlToMarkdown(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<!--\s*SC_OFF\s*-->|<!--\s*SC_ON\s*-->/g, "")
      .replace(/<\/p>\s*<p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div)>/gi, "")
      .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
      .replace(/<b>(.*?)<\/b>/gi, "**$1**")
      .replace(/<em>(.*?)<\/em>/gi, "*$1*")
      .replace(/<i>(.*?)<\/i>/gi, "*$1*")
      .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
      .replace(/<li>(.*?)<\/li>/gi, "- $1\n")
      .replace(/<\/?(ul|ol)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  ).trim();
}

function extractRedditBody(p: Record<string, unknown>): string | null {
  const tryStr = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };
  const selftext = tryStr(p.selftext);
  if (selftext) return selftext;
  const selftextHtml = tryStr(p.selftext_html);
  if (selftextHtml) return htmlToMarkdown(selftextHtml);
  // Crosspost fallback
  const cp = Array.isArray(p.crosspost_parent_list) ? p.crosspost_parent_list[0] : null;
  if (cp && typeof cp === "object") {
    const cpBody = extractRedditBody(cp as Record<string, unknown>);
    if (cpBody) return cpBody;
  }
  // Media oembed description for link posts
  const media = p.media as Record<string, unknown> | null | undefined;
  const oembed = media?.oembed as Record<string, unknown> | undefined;
  const desc = tryStr(oembed?.description);
  if (desc) return desc;
  return null;
}



type SerpRedditHit = {
  reddit_post_id: string;
  reddit_url: string;
  title: string;
  body: string | null;
  position: number;
};

async function brightdataSerpReddit(keyword: string, logContext: ApiCallContext): Promise<ApiCallResult<SerpRedditHit[]>> {
  const key = process.env.BRIGHTDATA_API_KEY;
  const url =
    "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_mfz5x93lmsjjjylob&custom_output_fields=organic";
  if (!key) {
    await recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: logContext.orgId ?? null,
      api_platform: "brightdata",
      feature: "scan",
      operation: "serp_reddit",
      endpoint: url,
      ok: false,
      status_code: 0,
      latency_ms: 0,
      error_message: "BRIGHTDATA_API_KEY not set",
      request_meta: { keyword },
    });
    return { ok: false, error: "BRIGHTDATA_API_KEY not set", status: 0 };
  }
  const startedAt = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      {
        url: "https://www.google.com/",
        keyword,
        country: "US",
        language: "en",
        start_page: 1,
        end_page: 10,
        include_paginated_html: false,
      },
    ]),
  });
  const text = await res.text();
  if (!res.ok) {
    await recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: logContext.orgId ?? null,
      api_platform: "brightdata",
      feature: "scan",
      operation: "serp_reddit",
      endpoint: url,
      ok: false,
      status_code: res.status,
      latency_ms: Date.now() - startedAt,
      error_message: `BrightData ${res.status}: ${text.slice(0, 200)}`,
      request_meta: { keyword },
      response_meta: { body_preview: text.slice(0, 500) },
    });
    return { ok: false, error: `BrightData ${res.status}: ${text.slice(0, 200)}`, status: res.status };
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch {
    await recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: logContext.orgId ?? null,
      api_platform: "brightdata",
      feature: "scan",
      operation: "serp_reddit",
      endpoint: url,
      ok: false,
      status_code: res.status,
      latency_ms: Date.now() - startedAt,
      error_message: `BrightData parse error: ${text.slice(0, 200)}`,
      request_meta: { keyword },
      response_meta: { body_preview: text.slice(0, 500) },
    });
    return { ok: false, error: `BrightData parse error: ${text.slice(0, 200)}`, status: res.status };
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const out: SerpRedditHit[] = [];
  const re = /reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/i;
  for (const row of rows as Array<Record<string, unknown>>) {
    const organic = (row.organic as Array<Record<string, unknown>> | undefined) ?? null;
    if (!organic || !Array.isArray(organic)) continue;
    organic.forEach((h, idx) => {
      const link = String(h.link ?? h.url ?? "");
      const m = link.match(re);
      if (!m) return;
      out.push({
        reddit_post_id: m[1],
        reddit_url: link,
        title: String(h.title ?? ""),
        body: (h.description ?? h.snippet ?? null) as string | null,
        position: Number(h.rank ?? h.position ?? idx + 1),
      });
    });
  }
  const deduped = uniqueByRedditPostId(out).map((row) => {
    const competing = out.filter((x) => x.reddit_post_id.toLowerCase() === row.reddit_post_id.toLowerCase());
    return competing.sort((a, b) => (a.position ?? 999) - (b.position ?? 999))[0] ?? row;
  });

  void recordApiCall(logContext.supabase, {
    user_id: logContext.userId,
    org_id: logContext.orgId ?? null,
    api_platform: "brightdata",
    feature: "scan",
    operation: "serp_reddit",
    endpoint: url,
    ok: true,
    status_code: res.status,
    latency_ms: Date.now() - startedAt,
    request_meta: { keyword },
    response_meta: { hits: deduped.length, response_bytes: text.length },
  });
  return { ok: true, data: deduped, status: res.status };
}

async function scoreWithDeepseek(args: {
  productName: string;
  productDescription: string;
  title: string;
  body: string | null;
}, logContext: ApiCallContext): Promise<{ score: number | null; reason: string | null }> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { score: null, reason: null };
  try {
    const prompt = `You score Reddit posts for marketing relevance to a product.

Product: ${args.productName}
Product description: ${args.productDescription}

Reddit post title: ${args.title}
Reddit post body: ${(args.body ?? "").slice(0, 1500)}

Return JSON: {"score": <0-100 integer>, "reason": "<short one-sentence reason>"}.
- 90-100: perfect match, user is actively looking for something this product solves.
- 60-89: strong topical match.
- 30-59: tangential.
- 0-29: irrelevant or off-topic.`;
    const endpoint = "https://api.deepseek.com/v1/chat/completions";
    const startedAt = Date.now();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      await recordApiCall(logContext.supabase, {
        user_id: logContext.userId,
        org_id: logContext.orgId ?? null,
        api_platform: "deepseek",
        feature: "scan",
        operation: "score_post",
        endpoint,
        model: "deepseek-chat",
        ok: false,
        status_code: res.status,
        latency_ms: Date.now() - startedAt,
        error_message: `DeepSeek ${res.status}`,
        request_meta: { productName: args.productName, title: args.title },
      });
      return { score: null, reason: null };
    }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return { score: null, reason: null };
    const parsed = JSON.parse(content) as { score?: number; reason?: string };
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score ?? 0))));
    void recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: logContext.orgId ?? null,
      api_platform: "deepseek",
      feature: "scan",
      operation: "score_post",
      endpoint,
      model: "deepseek-chat",
      ok: true,
      status_code: res.status,
      latency_ms: Date.now() - startedAt,
      input_tokens: json.usage?.prompt_tokens ?? null,
      output_tokens: json.usage?.completion_tokens ?? null,
      total_tokens: json.usage?.total_tokens ?? null,
      request_meta: { productName: args.productName, title: args.title },
      response_meta: { score },
    });
    return { score, reason: parsed.reason ?? null };
  } catch (e) {
    console.error("[deepseek] scoring failed", (e as Error).message);
    return { score: null, reason: null };
  }
}

async function scorePostsBatch<T extends { title: string; body: string | null }>(
  posts: T[],
  productName: string,
  productDescription: string,
  logContext: ApiCallContext,
): Promise<Array<T & { relevance_score: number | null; score_reason: string | null }>> {
  const limited = posts.slice(0, 25);
  const scored = await Promise.all(
    limited.map(async (p) => {
      const s = await scoreWithDeepseek({ productName, productDescription, title: p.title, body: p.body }, logContext);
      return { ...p, relevance_score: s.score, score_reason: s.reason };
    }),
  );
  // Any extras beyond 25 get null scores
  const extras = posts.slice(25).map((p) => ({ ...p, relevance_score: null, score_reason: null }));
  return [...scored, ...extras];
}

type JobResult = {
  ranJob: boolean;
  jobId?: string;
  jobType?: JobType;
  entityLabel?: string;
  status?: "ok" | "error";
  httpStatus?: number;
  inserted?: number;
  error?: string;
  remaining: number;
};

export const runOneScanJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<JobResult> => {
    const { supabase } = context;
    const { orgId } = data;
    const logContext: ApiCallContext = { supabase, userId: context.userId, orgId };

    const { data: org } = await supabase
      .from("organizations").select("product_name, product_description").eq("id", orgId).single();
    const productName = org?.product_name ?? "Product";
    const productDescription = org?.product_description ?? "";

    // ---- Throttling: skip claiming when org's "new" inbox is full ----
    async function newCount(sources: string[]) {
      const { count } = await supabase
        .from("inbox_items")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "new")
        .in("source", sources);
      return count ?? 0;
    }
    const [redditNew, serpNew] = await Promise.all([
      newCount(["sociavault_keyword", "sociavault_competitor"]),
      newCount(["brightdata_serp"]),
    ]);
    const competitorNew = await (async () => {
      const { count } = await supabase
        .from("inbox_items")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "new")
        .not("competitor_id", "is", null);
      return count ?? 0;
    })();
    const throttled = {
      keyword_reddit: redditNew >= 500,
      competitor_reddit: competitorNew >= 200,
      keyword_serp: serpNew >= 50,
      competitor_serp: serpNew >= 50,
    } as Record<JobType, boolean>;
    // NOTE: keyword_serp + competitor_serp jobs are deprecated. SEO posts are now
    // fetched once a day per org by the AI hidden-keyword rotator (src/lib/seo.functions.ts).
    const allowedTypes: JobType[] = (["keyword_reddit", "competitor_reddit"] as JobType[]).filter((t) => !throttled[t]);

    let job: { id: string; job_type: JobType; entity_id: string } | undefined;
    if (allowedTypes.length > 0) {
      const { data: claimed, error: claimErr } = await supabase.rpc("claim_scan_jobs", { _org_id: orgId, _limit: 1 });
      if (claimErr) throw new Error(`claim failed: ${claimErr.message}`);
      const candidate = (claimed as Array<{ id: string; job_type: JobType; entity_id: string }> | null)?.[0];
      if (candidate && allowedTypes.includes(candidate.job_type)) {
        job = candidate;
      } else if (candidate) {
        // release immediately if claimed type is throttled
        await supabase.from("scan_jobs").update({ status: "pending", next_run_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }).eq("id", candidate.id);
      }
    }


    const { count: remaining } = await supabase
      .from("scan_jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["pending", "running"])
      .lte("next_run_at", new Date().toISOString());

    if (!job) return { ranJob: false, remaining: remaining ?? 0 };

    const cadence = CADENCE_MS[job.job_type];
    const reschedule = async (errorMessage: string | null, retryAfterMs?: number) => {
      const nextRun = new Date(Date.now() + (retryAfterMs ?? (errorMessage ? 15 * 60 * 1000 : cadence))).toISOString();
      await supabase.from("scan_jobs").update({
        status: "pending",
        next_run_at: nextRun,
        error_message: errorMessage,
      }).eq("id", job.id);
    };

    let entityLabel = "";

    try {
      if (job.job_type === "keyword_reddit") {
        const { data: kw } = await supabase
          .from("keywords").select("keyword").eq("id", job.entity_id).maybeSingle();
        entityLabel = kw?.keyword ?? job.entity_id;
        if (!kw?.keyword) {
          await reschedule(null);
          return { ranJob: true, jobId: job.id, jobType: job.job_type, entityLabel, status: "ok", inserted: 0, remaining: (remaining ?? 1) - 1 };
        }
        const r = await sociavaultRedditSearch(kw.keyword, logContext);
        if (!r.ok) {
          await reschedule(r.error, r.status === 402 ? 24 * 60 * 60 * 1000 : undefined);
          return { ranJob: true, jobId: job.id, jobType: job.job_type, entityLabel, status: "error", httpStatus: r.status, error: r.error, remaining: (remaining ?? 1) - 1 };
        }
        const scored = await scorePostsBatch(r.data, productName, productDescription, logContext);
        let inserted = 0;
        if (scored.length) {
          const rows = uniqueByRedditPostId(scored).map((p) => ({
            org_id: orgId, keyword_id: job.entity_id, source: "sociavault_keyword",
            reddit_post_id: p.reddit_post_id, reddit_url: p.reddit_url, title: p.title, body: p.body,
            author: p.author, subreddit: p.subreddit, num_comments: p.num_comments, upvotes: p.upvotes,
            upvote_ratio: p.upvote_ratio, reddit_created_at: p.reddit_created_at,
            relevance_score: p.relevance_score, score_reason: p.score_reason,
          }));
          const { count, error } = await supabase
            .from("inbox_items")
            .upsert(rows, { onConflict: "org_id,reddit_post_id", ignoreDuplicates: true, count: "exact" });
          if (error) throw error;
          inserted = count ?? 0;
        }
        await supabase.from("keywords").update({ last_reddit_scan_at: new Date().toISOString() }).eq("id", job.entity_id);
        await reschedule(null);
        return { ranJob: true, jobId: job.id, jobType: job.job_type, entityLabel, status: "ok", httpStatus: r.status, inserted, remaining: (remaining ?? 1) - 1 };
      }

      if (job.job_type === "competitor_reddit") {
        const { data: comp } = await supabase
          .from("competitors").select("name").eq("id", job.entity_id).maybeSingle();
        entityLabel = comp?.name ?? job.entity_id;
        if (!comp?.name) {
          await reschedule(null);
          return { ranJob: true, jobId: job.id, jobType: job.job_type, entityLabel, status: "ok", inserted: 0, remaining: (remaining ?? 1) - 1 };
        }
        const r = await sociavaultRedditSearch(comp.name, logContext);
        if (!r.ok) {
          await reschedule(r.error, r.status === 402 ? 24 * 60 * 60 * 1000 : undefined);
          return { ranJob: true, jobId: job.id, jobType: job.job_type, entityLabel, status: "error", httpStatus: r.status, error: r.error, remaining: (remaining ?? 1) - 1 };
        }
        const scored = await scorePostsBatch(r.data, productName, productDescription, logContext);
        let inserted = 0;
        if (scored.length) {
          const rows = uniqueByRedditPostId(scored).map((p) => ({
            org_id: orgId, competitor_id: job.entity_id, source: "sociavault_competitor",
            reddit_post_id: p.reddit_post_id, reddit_url: p.reddit_url, title: p.title, body: p.body,
            author: p.author, subreddit: p.subreddit, num_comments: p.num_comments, upvotes: p.upvotes,
            upvote_ratio: p.upvote_ratio, reddit_created_at: p.reddit_created_at,
            relevance_score: p.relevance_score, score_reason: p.score_reason,
          }));
          const { count, error } = await supabase
            .from("inbox_items")
            .upsert(rows, { onConflict: "org_id,reddit_post_id", ignoreDuplicates: true, count: "exact" });
          if (error) throw error;
          inserted = count ?? 0;
        }
        await supabase.from("competitors").update({ last_reddit_scan_at: new Date().toISOString() }).eq("id", job.entity_id);
        await reschedule(null);
        return { ranJob: true, jobId: job.id, jobType: job.job_type, entityLabel, status: "ok", httpStatus: r.status, inserted, remaining: (remaining ?? 1) - 1 };
      }

      if (job.job_type === "keyword_serp" || job.job_type === "competitor_serp") {
        let queryTerm = "";
        if (job.job_type === "keyword_serp") {
          const { data: kw } = await supabase
            .from("keywords").select("keyword").eq("id", job.entity_id).maybeSingle();
          queryTerm = kw?.keyword ?? "";
          entityLabel = queryTerm || job.entity_id;
        } else {
          const { data: comp } = await supabase
            .from("competitors").select("name").eq("id", job.entity_id).maybeSingle();
          queryTerm = comp?.name ?? "";
          entityLabel = queryTerm || job.entity_id;
        }
        if (!queryTerm) {
          await reschedule(null);
          return { ranJob: true, jobId: job.id, jobType: job.job_type, entityLabel, status: "ok", inserted: 0, remaining: (remaining ?? 1) - 1 };
        }
        const r = await brightdataSerpReddit(queryTerm, logContext);
        if (!r.ok) {
          await reschedule(r.error);
          return { ranJob: true, jobId: job.id, jobType: job.job_type, entityLabel, status: "error", httpStatus: r.status, error: r.error, remaining: (remaining ?? 1) - 1 };
        }
        const scored = await scorePostsBatch(r.data, productName, productDescription, logContext);
        let inserted = 0;
        if (scored.length) {
          const rows = uniqueByRedditPostId(scored).map((h) => ({
            org_id: orgId,
            ...(job.job_type === "keyword_serp" ? { keyword_id: job.entity_id } : { competitor_id: job.entity_id }),
            source: "brightdata_serp",
            reddit_post_id: h.reddit_post_id, reddit_url: h.reddit_url, title: h.title, body: h.body,
            google_position: h.position, serp_keyword: queryTerm,
            relevance_score: h.relevance_score, score_reason: h.score_reason,
          }));
          const { count, error } = await supabase
            .from("inbox_items")
            .upsert(rows, { onConflict: "org_id,reddit_post_id", ignoreDuplicates: true, count: "exact" });
          if (error) throw error;
          inserted = count ?? 0;
        }
        if (job.job_type === "keyword_serp") {
          await supabase.from("keywords").update({ last_serp_scan_at: new Date().toISOString() }).eq("id", job.entity_id);
        }
        await reschedule(null);
        return { ranJob: true, jobId: job.id, jobType: job.job_type, entityLabel, status: "ok", httpStatus: r.status, inserted, remaining: (remaining ?? 1) - 1 };
      }

      await reschedule(null);
      return { ranJob: true, jobId: job.id, jobType: job.job_type, entityLabel, status: "ok", inserted: 0, remaining: (remaining ?? 1) - 1 };
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      console.error(`[scan] job=${job.job_type} failed: ${msg}`);
      await reschedule(msg);
      return { ranJob: true, jobId: job.id, jobType: job.job_type, entityLabel, status: "error", error: msg, remaining: (remaining ?? 1) - 1 };
    }
  });

export const retryScanJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("scan_jobs")
      .update({ status: "pending", next_run_at: new Date().toISOString(), error_message: null })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listInboxItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      orgId: z.string().uuid(),
      source: z.enum(["sociavault_keyword", "sociavault_competitor", "brightdata_serp"]).optional(),
      competitorId: z.string().uuid().optional(),
      keywordId: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("inbox_items")
      .select("*")
      .eq("org_id", data.orgId)
      .order("relevance_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.source) q = q.eq("source", data.source);
    if (data.competitorId) q = q.eq("competitor_id", data.competitorId);
    if (data.keywordId) q = q.eq("keyword_id", data.keywordId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const out = rows ?? [];
    const seen = new Set<string>();
    return out.filter((row) => {
      const id = String((row as { reddit_post_id: string | null }).reddit_post_id ?? "").trim().toLowerCase();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  });

export const listOrgKeywords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("keywords").select("id, keyword").eq("org_id", data.orgId).order("keyword");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listOrgCompetitors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("competitors").select("id, name").eq("org_id", data.orgId).order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });


export const getScanProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const nowIso = new Date().toISOString();
    const { count: due } = await supabase
      .from("scan_jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", data.orgId)
      .in("status", ["pending", "running"])
      .lte("next_run_at", nowIso);
    const { count: total } = await supabase
      .from("scan_jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", data.orgId);

    // Next scan timestamps per category
    const nextOf = async (types: JobType[]) => {
      const { data: rows } = await supabase
        .from("scan_jobs")
        .select("next_run_at")
        .eq("org_id", data.orgId)
        .in("job_type", types)
        .order("next_run_at", { ascending: true })
        .limit(1);
      return rows?.[0]?.next_run_at ?? null;
    };
    const [nextSerp, nextCompetitor, nextRedditKw] = await Promise.all([
      nextOf(["keyword_serp", "competitor_serp"]),
      nextOf(["competitor_reddit"]),
      nextOf(["keyword_reddit"]),
    ]);

    return {
      due: due ?? 0,
      total: total ?? 0,
      next_serp_at: nextSerp,
      next_competitor_at: nextCompetitor,
      next_reddit_at: nextRedditKw,
    };
  });

type ScanJobRow = {
  id: string;
  job_type: JobType;
  entity_id: string;
  status: string;
  next_run_at: string;
  last_run_at: string | null;
  error_message: string | null;
};

export const listScanJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: jobs, error } = await supabase
      .from("scan_jobs")
      .select("id, job_type, entity_id, status, next_run_at, last_run_at, error_message")
      .eq("org_id", data.orgId)
      .order("job_type");
    if (error) throw new Error(error.message);
    const rows = (jobs ?? []) as ScanJobRow[];
    const kwIds = Array.from(new Set(rows.filter(r => r.job_type === "keyword_reddit" || r.job_type === "keyword_serp").map(r => r.entity_id)));
    const compIds = Array.from(new Set(rows.filter(r => r.job_type === "competitor_reddit" || r.job_type === "competitor_serp").map(r => r.entity_id)));
    const [{ data: kws }, { data: comps }] = await Promise.all([
      kwIds.length ? supabase.from("keywords").select("id, keyword").in("id", kwIds) : Promise.resolve({ data: [] as Array<{ id: string; keyword: string }> }),
      compIds.length ? supabase.from("competitors").select("id, name").in("id", compIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);
    const kwMap = new Map((kws ?? []).map(k => [k.id, k.keyword]));
    const compMap = new Map((comps ?? []).map(c => [c.id, c.name]));
    return rows.map(r => ({
      ...r,
      entity_label:
        r.job_type === "keyword_reddit" || r.job_type === "keyword_serp"
          ? kwMap.get(r.entity_id) ?? r.entity_id
          : compMap.get(r.entity_id) ?? r.entity_id,
    }));
  });
