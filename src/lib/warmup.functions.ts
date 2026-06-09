import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPrompt, fillPrompt } from "./prompts.server";
import { recordApiCall } from "./api-logging";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

const SUBREDDIT_RE = /^[A-Za-z0-9_]{2,30}$/;

type LogContext = { supabase: unknown; userId: string };

async function scrapeSubreddit(name: string, logContext: LogContext) {
  const key = process.env.SOCIAVAULT_API_KEY;
  const url = `https://api.sociavault.com/v1/scrape/reddit/subreddit?subreddit=${encodeURIComponent(name)}&timeframe=day&sort=top&trim=true`;
  if (!key) {
    void recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: null,
      api_platform: "sociavault",
      feature: "warmup",
      operation: "scrape_subreddit",
      endpoint: url,
      ok: false,
      status_code: 0,
      latency_ms: 0,
      error_message: "SOCIAVAULT_API_KEY not set",
      request_meta: { subreddit: name },
    });
    throw new Error("SOCIAVAULT_API_KEY not set");
  }
  const startedAt = Date.now();
  const res = await fetch(url, { headers: { "X-API-Key": key } });
  if (!res.ok) {
    const t = await res.text();
    void recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: null,
      api_platform: "sociavault",
      feature: "warmup",
      operation: "scrape_subreddit",
      endpoint: url,
      ok: false,
      status_code: res.status,
      latency_ms: Date.now() - startedAt,
      error_message: `Sociavault ${res.status}: ${t.slice(0, 200)}`,
      request_meta: { subreddit: name },
      response_meta: { body_preview: t.slice(0, 500) },
    });
    throw new Error(`Sociavault ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json() as { success: boolean; data: { posts: Record<string, unknown> }; creditsUsed?: number };
  void recordApiCall(logContext.supabase, {
    user_id: logContext.userId,
    org_id: null,
    api_platform: "sociavault",
    feature: "warmup",
    operation: "scrape_subreddit",
    endpoint: url,
    ok: true,
    status_code: res.status,
    latency_ms: Date.now() - startedAt,
    request_meta: { subreddit: name },
    response_meta: { creditsUsed: json.creditsUsed ?? 1, post_groups: Object.keys(json.data?.posts ?? {}).length },
  });
  return json;
}

function postsToArray(payload: { data?: { posts?: Record<string, unknown> | unknown[] } } | null): unknown[] {
  const posts = payload?.data?.posts ?? {};
  if (Array.isArray(posts)) return posts;
  return Object.values(posts);
}

function dedupeWarmupPosts(posts: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of posts) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const key = String(p.id ?? p.name ?? p.permalink ?? p.url ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

// ---------- ADMIN ----------
// We use context.supabase (RLS via has_role admin policies) instead of
// supabaseAdmin so admin writes work without the SUPABASE_SERVICE_ROLE_KEY
// being available at runtime.

export const adminListSubreddits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("warmup_subreddits")
      .select("id, name, description, rules, allows_body, created_at, updated_at")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminAddSubreddit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      name: z.string().regex(SUBREDDIT_RE, "Use a valid subreddit name (letters/numbers/_)"),
      description: z.string().max(10000).optional().default(""),
      rules: z.string().max(50000).optional().default(""),
      allows_body: z.boolean().optional().default(true),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("warmup_subreddits")
      .insert({ name: data.name, description: data.description, rules: data.rules, allows_body: data.allows_body, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    // Fire instant scan — surface errors so admin can see + retry
    let scan_error: string | null = null;
    try {
      const r = await scrapeSubreddit(data.name, { supabase: context.supabase, userId: context.userId });
      const posts = dedupeWarmupPosts(postsToArray(r));
      const { error: insErr } = await context.supabase.from("warmup_scans").insert({
        subreddit_id: row.id,
        posts: posts as never,
        credits_used: r.creditsUsed ?? 1,
      });
      if (insErr) throw new Error(insErr.message);
    } catch (e) {
      scan_error = e instanceof Error ? e.message : String(e);
      console.error("[adminAddSubreddit] initial scan failed", scan_error);
    }
    return { ...row, scan_error };
  });

export const adminRescanSubreddit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: sub, error } = await context.supabase
      .from("warmup_subreddits")
      .select("id, name")
      .eq("id", data.id)
      .single();
    if (error || !sub) throw new Error("Subreddit not found");
    const r = await scrapeSubreddit(sub.name, { supabase: context.supabase, userId: context.userId });
    const posts = dedupeWarmupPosts(postsToArray(r));
    const { error: insErr } = await context.supabase.from("warmup_scans").insert({
      subreddit_id: sub.id,
      posts: posts as never,
      credits_used: r.creditsUsed ?? 1,
    });
    if (insErr) throw new Error(insErr.message);
    return { ok: true, count: posts.length };
  });

export const adminUpdateSubreddit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      description: z.string().max(10000),
      rules: z.string().max(50000),
      allows_body: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch: { description: string; rules: string; allows_body?: boolean } = {
      description: data.description,
      rules: data.rules,
    };
    if (typeof data.allows_body === "boolean") patch.allows_body = data.allows_body;
    const { error } = await context.supabase
      .from("warmup_subreddits")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



export const adminDeleteSubreddit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("warmup_subreddits").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- USER ----------

export const listAvailableSubreddits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("warmup_subreddits")
      .select("id, name, description")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export type WarmupSubLite = { id: string; name: string; description: string | null; rules: string | null };
export type RedditPostLite = {
  id?: string; title?: string; subreddit?: string; author?: string;
  selftext?: string; selftext_html?: string; ups?: number; num_comments?: number; permalink?: string; url?: string;
};
export type WarmupScanLite = { posts: RedditPostLite[]; scanned_at: string };

export type WarmupFeedItem = {
  key: string;            // synthetic unique id for list rendering
  subreddit_id: string;
  subreddit: string;
  scanned_at: string;
  post_id: string;
  title: string;
  author: string;
  selftext: string;
  ups: number;
  num_comments: number;
  permalink: string;
  url: string;
  status: "new" | "engaged" | "saved" | "hidden";
  engaged_at: string | null;
};

export const listWarmupFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i ?? {}))
  .handler(async ({ data, context }): Promise<{ subreddits: Array<{ id: string; name: string }>; items: WarmupFeedItem[] }> => {
    const { data: subs } = await context.supabase
      .from("warmup_subreddits")
      .select("id, name");
    const list = (subs ?? []) as Array<{ id: string; name: string }>;
    if (list.length === 0) return { subreddits: [], items: [] };

    const [{ data: scans }, { data: engagements }] = await Promise.all([
      context.supabase
        .from("warmup_scans")
        .select("subreddit_id, posts, scanned_at")
        .order("scanned_at", { ascending: false }),
      context.supabase
        .from("warmup_engagements")
        .select("subreddit_id, post_id, status, engaged_at")
        .eq("user_id", context.userId)
        .eq("org_id", data.orgId),
    ]);

    const engMap = new Map<string, { status: string; engaged_at: string }>();
    for (const e of (engagements ?? []) as Array<{ subreddit_id: string; post_id: string; status: string; engaged_at: string }>) {
      engMap.set(`${e.subreddit_id}:${e.post_id}`, { status: e.status, engaged_at: e.engaged_at });
    }

    // Take latest scan per subreddit
    const latest: Record<string, { posts: RedditPostLite[]; scanned_at: string }> = {};
    for (const row of (scans ?? []) as Array<{ subreddit_id: string; posts: RedditPostLite[]; scanned_at: string }>) {
      if (!latest[row.subreddit_id]) {
        latest[row.subreddit_id] = { posts: (row.posts as RedditPostLite[]) ?? [], scanned_at: row.scanned_at };
      }
    }
    const items: WarmupFeedItem[] = [];
    for (const s of list) {
      const l = latest[s.id];
      if (!l) continue;
      for (const p of dedupeWarmupPosts(l.posts).slice(0, 25)) {
        const post = p as RedditPostLite;
        const pid = String(post.id ?? "");
        if (!pid) continue;
        const rawBody = (typeof post.selftext === "string" && post.selftext.trim()) ? post.selftext : (post.selftext_html ?? "");
        const body = normalizeWarmupBody(rawBody);

        const eng = engMap.get(`${s.id}:${pid}`);
        items.push({
          key: `${s.id}:${pid}`,
          subreddit_id: s.id,
          subreddit: s.name,
          scanned_at: l.scanned_at,
          post_id: pid,
          title: post.title ?? "",
          author: post.author ?? "",
          selftext: body,
          ups: Number(post.ups ?? 0),
          num_comments: Number(post.num_comments ?? 0),
          permalink: post.permalink ?? "",
          url: post.url ?? "",
          status: (eng?.status as WarmupFeedItem["status"]) ?? "new",
          engaged_at: eng?.engaged_at ?? null,
        });
      }
    }
    return { subreddits: list, items };
  });

function normalizeWarmupBody(body: string) {
  const trimmed = body.trim();
  if (!trimmed) return "";
  let out = trimmed;
  if (out.includes("<p>") || out.includes("<div") || out.includes("<br")) {
    out = out
      .replace(/<\/?div[^>]*>/gi, "\n")
      .replace(/<\/?p[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "");
  }
  return out
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x200B;|\u200B/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripJsonFences(input: string): string {
  let s = input.trim();
  // Strip ```json ... ``` or ``` ... ``` wrappers
  const fence = s.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  if (fence) s = fence[1].trim();
  // Some models wrap with just leading/trailing ``` without newlines
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").trim();
  if (s.endsWith("```")) s = s.replace(/```$/i, "").trim();
  return s;
}




export const markWarmupEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      orgId: z.string().uuid(),
      subredditId: z.string().uuid(),
      postId: z.string().min(1).max(100),
      status: z.enum(["new", "engaged", "saved", "hidden"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.status === "new") {
      const { error } = await context.supabase
        .from("warmup_engagements")
        .delete()
        .eq("user_id", context.userId)
        .eq("subreddit_id", data.subredditId)
        .eq("post_id", data.postId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase
      .from("warmup_engagements")
      .upsert(
        {
          user_id: context.userId,
          org_id: data.orgId,
          subreddit_id: data.subredditId,
          post_id: data.postId,
          status: data.status,
          engaged_at: new Date().toISOString(),
        },
        { onConflict: "user_id,subreddit_id,post_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ---------- COMPOSE ----------

export const generateWarmupPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ subredditId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sub, error } = await supabase
      .from("warmup_subreddits")
      .select("name, description, rules, allows_body")
      .eq("id", data.subredditId)
      .single();
    if (error || !sub) throw new Error("Subreddit not found");

    const tmpl = await getPrompt("warmup.post");
    const allowsBody = sub.allows_body !== false;
    const postFormat = allowsBody
      ? "Return BOTH a title and a body. Body should be 2–6 short paragraphs of genuine, on-topic content. No links, no self-promotion, no product mentions."
      : "TITLE-ONLY subreddit. The body MUST be an empty string. Put the entire post into the title (max 300 chars).";
    const systemPrompt =
      `You write Reddit posts that strictly follow the subreddit description and rules provided in the user message. Never promote any product. Never ask the user clarifying questions. Never refuse — the subreddit context is already provided. Output ONLY a single JSON object: {"title":"","body":""}. No prose, no markdown code fences, no \`\`\`json wrappers.`;
    const userMsg = fillPrompt(tmpl, {
      subreddit: sub.name,
      description: sub.description ?? "",
      rules: sub.rules ?? "(no specific rules — follow general Reddit etiquette)",
      post_format: postFormat,
    });


    const endpoint = "https://api.anthropic.com/v1/messages";
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      void recordApiCall(supabase, {
        user_id: context.userId,
        org_id: null,
        api_platform: "claude",
        feature: "warmup",
        operation: "generate_warmup_post",
        endpoint,
        model: "claude-sonnet-4-5-20250929",
        ok: false,
        status_code: 0,
        latency_ms: 0,
        error_message: "ANTHROPIC_API_KEY not set",
        request_meta: { subredditId: data.subredditId, subreddit: sub.name },
      });
      throw new Error("ANTHROPIC_API_KEY not set");
    }

    const startedAt = Date.now();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 900,
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      void recordApiCall(supabase, {
        user_id: context.userId,
        org_id: null,
        api_platform: "claude",
        feature: "warmup",
        operation: "generate_warmup_post",
        endpoint,
        model: "claude-sonnet-4-5-20250929",
        ok: false,
        status_code: res.status,
        latency_ms: Date.now() - startedAt,
        error_message: `Claude ${res.status}: ${t.slice(0, 200)}`,
        request_meta: { subredditId: data.subredditId, subreddit: sub.name },
        response_meta: { body_preview: t.slice(0, 500) },
      });
      throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = await res.json() as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    const raw = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim() || "{}";
    const cleaned = stripJsonFences(raw);
    let parsed: { title?: string; body?: string } = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { title: "", body: cleaned }; }
    const title = parsed.title ?? "";
    const body = parsed.body ?? "";

    void recordApiCall(supabase, {
      user_id: context.userId,
      org_id: null,
      api_platform: "claude",
      feature: "warmup",
      operation: "generate_warmup_post",
      endpoint,
      model: "claude-sonnet-4-5-20250929",
      ok: true,
      status_code: res.status,
      latency_ms: Date.now() - startedAt,
      input_tokens: json.usage?.input_tokens ?? null,
      output_tokens: json.usage?.output_tokens ?? null,
      request_meta: { subredditId: data.subredditId, subreddit: sub.name },
      response_meta: { title_length: title.length, body_length: body.length },
    });
    return { title, body };
  });

const COMMENT_TONES: Record<string, string> = {
  helpful: "Give ONE concrete tip that solves the OP's problem. Max 2 sentences.",
  personal: "Share a brief personal experience in 1 sentence + 1 sentence takeaway. Max 2 sentences.",
  curious: "Ask ONE short clarifying question to understand the OP better. Max 1-2 sentences.",
  direct: "Recommend a solution directly in 1 short sentence. No hedging.",
  friendly: "Warm + useful response, max 2 sentences. No fluff.",
};

export const generateWarmupComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      subredditId: z.string().uuid(),
      title: z.string().min(1).max(300),
      body: z.string().max(4000).optional().default(""),
      tone: z.string().min(1).max(40).default("helpful"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sub, error } = await supabase
      .from("warmup_subreddits")
      .select("name, description, rules")
      .eq("id", data.subredditId)
      .single();
    if (error || !sub) throw new Error("Subreddit not found");

    const endpoint = "https://api.anthropic.com/v1/messages";
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY not set");

    const toneInstr = COMMENT_TONES[data.tone] ?? COMMENT_TONES.helpful;
    const rules = `Hard rules:\n- SHORT. Max 60 words total. 1-3 sentences.\n- Reddit-native voice — no corporate tone, no signoffs\n- No emojis, no em-dashes, no hashtags\n- Plain text only\n- No product promotion`;
    const userMsg = `${toneInstr}\n\nSubreddit: r/${sub.name}\nPost title: ${data.title}\nPost body: ${data.body}\n\nSubreddit description: ${sub.description ?? ""}\nSubreddit rules: ${sub.rules ?? "(none provided)"}\n\n${rules}`;

    const startedAt = Date.now();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 220,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      void recordApiCall(supabase, {
        user_id: context.userId,
        org_id: null,
        api_platform: "claude",
        feature: "warmup",
        operation: "generate_warmup_comment",
        endpoint,
        model: "claude-sonnet-4-5-20250929",
        ok: false,
        status_code: res.status,
        latency_ms: Date.now() - startedAt,
        error_message: `Claude ${res.status}: ${t.slice(0, 200)}`,
        request_meta: { subredditId: data.subredditId, subreddit: sub.name, tone: data.tone },
        response_meta: { body_preview: t.slice(0, 500) },
      });
      throw new Error(`Claude ${res.status}: ${t.slice(0, 200)}`);
    }

    const json = await res.json() as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    const comment = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
    if (!comment) throw new Error("Empty response from Claude");

    void recordApiCall(supabase, {
      user_id: context.userId,
      org_id: null,
      api_platform: "claude",
      feature: "warmup",
      operation: "generate_warmup_comment",
      endpoint,
      model: "claude-sonnet-4-5-20250929",
      ok: true,
      status_code: res.status,
      latency_ms: Date.now() - startedAt,
      input_tokens: json.usage?.input_tokens ?? null,
      output_tokens: json.usage?.output_tokens ?? null,
      request_meta: { subredditId: data.subredditId, subreddit: sub.name, tone: data.tone },
      response_meta: { comment_length: comment.length },
    });

    return { comment };
  });

// ---------- CRON ----------
export async function runDailyWarmupScans() {
  const { data: subs, error } = await supabaseAdmin
    .from("warmup_subreddits")
    .select("id, name");
  if (error) throw new Error(error.message);
  const results: Array<{ name: string; ok: boolean; error?: string }> = [];
  for (const s of subs ?? []) {
    try {
      const r = await scrapeSubreddit(s.name, { supabase: supabaseAdmin, userId: "00000000-0000-0000-0000-000000000000" });
      const posts = dedupeWarmupPosts(postsToArray(r));
      await supabaseAdmin.from("warmup_scans").insert({
        subreddit_id: s.id,
        posts: posts as never,
        credits_used: r.creditsUsed ?? 1,
      });
      results.push({ name: s.name, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[warmup-scan] ${s.name} failed:`, msg);
      results.push({ name: s.name, ok: false, error: msg });
    }
  }
  return results;
}
