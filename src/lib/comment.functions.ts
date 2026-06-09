import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fillPrompt, getPrompt } from "./prompts.server";
import { recordApiCall } from "./api-logging";

const BUILTIN_TONES: Record<string, string> = {
  helpful: "Give ONE concrete tip that solves the OP's problem. Max 2 sentences.",
  personal: "Share a brief personal experience in 1 sentence + 1 sentence takeaway. Max 2 sentences.",
  curious: "Ask ONE short clarifying question to understand the OP better. Max 1-2 sentences.",
  direct: "Recommend a solution directly in 1 short sentence. No hedging.",
  friendly: "Warm + useful response, max 2 sentences. No fluff.",
};

const DEFAULT_RULES = `Hard rules:
- SHORT. Max 60 words total. 1-3 sentences.
- Reddit-native voice — no corporate tone, no "Great point", no "Hi OP", no signoffs
- No emojis, no em-dashes, no hashtags
- Plain text only
- Get straight to the point — no preamble`;

type PostContext = {
  core_problem: string | null;
  current_situation: string | null;
  desired_outcome: string | null;
  tone: string | null;
  subreddit_context: string | null;
};

type LogContext = {
  supabase: unknown;
  userId: string;
  orgId?: string | null;
};

export const generateComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      postId: z.string().uuid(),
      tone: z.string().min(1).max(40).default("helpful"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const endpoint = "https://api.anthropic.com/v1/messages";
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      void recordApiCall(supabase, {
        user_id: context.userId,
        org_id: null,
        api_platform: "claude",
        feature: "comment",
        operation: "generate_comment",
        endpoint,
        model: "claude-sonnet-4-5-20250929",
        ok: false,
        status_code: 0,
        latency_ms: 0,
        error_message: "ANTHROPIC_API_KEY not set",
        request_meta: { postId: data.postId, tone: data.tone },
      });
      throw new Error("ANTHROPIC_API_KEY not set");
    }

    const { data: post, error: postErr } = await supabase
      .from("inbox_items")
      .select("id, org_id, title, body, subreddit, author")
      .eq("id", data.postId)
      .single();
    if (postErr || !post) throw new Error("Post not found");

    const { data: org } = await supabase
      .from("organizations")
      .select("product_name, product_description, training_notes")
      .eq("id", post.org_id)
      .single();

    // Resolve tone: builtin OR custom personality for this org
    let toneInstr: string | undefined = BUILTIN_TONES[data.tone];
    if (!toneInstr) {
      const { data: persona } = await supabase
        .from("comment_personalities")
        .select("instructions")
        .eq("org_id", post.org_id)
        .eq("slug", data.tone)
        .maybeSingle();
      toneInstr = persona?.instructions;
    }
    // Admin override (read with user client — returns null for non-admins, that's fine)
    const { data: override } = await supabase
      .from("admin_prompts").select("content").eq("key", `tone.${data.tone}`).maybeSingle();
    if (override?.content) toneInstr = override.content;
    if (!toneInstr) toneInstr = BUILTIN_TONES.helpful;

    const { data: rulesRow } = await supabase
      .from("admin_prompts").select("content").eq("key", "comment.rules").maybeSingle();
    const rules = rulesRow?.content ?? DEFAULT_RULES;

    const contextPrompt = fillPrompt(
      await getPrompt("comment.context_extract"),
      {
        title: post.title,
        body: post.body ?? "",
      },
    );
    const postContext = await extractPostContext(contextPrompt, { supabase, userId: context.userId, orgId: post.org_id });

    const productCtx = org
      ? `You may subtly recommend the product "${org.product_name}" — only if it actually solves the OP's problem. Never sound like an ad. Product description: ${org.product_description ?? ""}`
      : "";

    const trainingCtx = org?.training_notes
      ? `\n\nWriter's voice & style notes (follow these):\n${org.training_notes}`
      : "";

    const userMsg = `${toneInstr}

${productCtx}${trainingCtx}

Subreddit: r/${post.subreddit ?? "unknown"}
Post title: ${post.title}
Post body: ${(post.body ?? "").slice(0, 2000)}
${postContext ? `\nPost context:\n${postContext}\n` : ""}

${rules}`;

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
        max_tokens: 250,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      void recordApiCall(supabase, {
        user_id: context.userId,
        org_id: post.org_id,
        api_platform: "claude",
        feature: "comment",
        operation: "generate_comment",
        endpoint,
        model: "claude-sonnet-4-5-20250929",
        ok: false,
        status_code: res.status,
        latency_ms: Date.now() - startedAt,
        error_message: `Claude ${res.status}: ${t.slice(0, 200)}`,
        request_meta: { postId: data.postId, tone: data.tone, subreddit: post.subreddit },
        response_meta: { body_preview: t.slice(0, 500) },
      });
      throw new Error(`Claude ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = await res.json() as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    const comment = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
    if (!comment) throw new Error("Empty response from Claude");

    void recordApiCall(supabase, {
      user_id: context.userId,
      org_id: post.org_id,
      api_platform: "claude",
      feature: "comment",
      operation: "generate_comment",
      endpoint,
      model: "claude-sonnet-4-5-20250929",
      ok: true,
      status_code: res.status,
      latency_ms: Date.now() - startedAt,
      input_tokens: json.usage?.input_tokens ?? null,
      output_tokens: json.usage?.output_tokens ?? null,
      request_meta: { postId: data.postId, tone: data.tone, subreddit: post.subreddit },
      response_meta: { comment_length: comment.length },
    });

    await supabase
      .from("inbox_items")
      .update({ generated_comment: comment })
      .eq("id", data.postId);

    return { comment };
  });

async function extractPostContext(prompt: string, logContext: LogContext): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  const endpoint = "https://api.anthropic.com/v1/messages";
  if (!key) {
    void recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: logContext.orgId ?? null,
      api_platform: "claude",
      feature: "comment",
      operation: "extract_post_context",
      endpoint,
      model: "claude-sonnet-4-5-20250929",
      ok: false,
      status_code: 0,
      latency_ms: 0,
      error_message: "ANTHROPIC_API_KEY not set",
    });
    return null;
  }
  try {
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
        max_tokens: 250,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      void recordApiCall(logContext.supabase, {
        user_id: logContext.userId,
        org_id: logContext.orgId ?? null,
        api_platform: "claude",
        feature: "comment",
        operation: "extract_post_context",
        endpoint,
        model: "claude-sonnet-4-5-20250929",
        ok: false,
        status_code: res.status,
        latency_ms: Date.now() - startedAt,
        error_message: `Claude ${res.status}: ${t.slice(0, 200)}`,
      });
      return null;
    }

    const json = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const text = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
    if (!text) return null;
    const parsed = JSON.parse(text) as PostContext;
    const lines = [
      parsed.core_problem ? `core_problem: ${parsed.core_problem}` : null,
      parsed.current_situation ? `current_situation: ${parsed.current_situation}` : null,
      parsed.desired_outcome ? `desired_outcome: ${parsed.desired_outcome}` : null,
      parsed.tone ? `tone: ${parsed.tone}` : null,
      parsed.subreddit_context ? `subreddit_context: ${parsed.subreddit_context}` : null,
    ].filter(Boolean);
    return lines.length ? lines.join("\n") : null;
  } catch {
    return null;
  }
}

export const markInboxItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      postId: z.string().uuid(),
      action: z.enum(["save", "unsave", "replied", "dismiss", "reset", "archive", "unarchive"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date().toISOString();
    const patch: {
      status?: "new" | "saved" | "replied" | "archived";
      saved_at?: string | null;
      replied_at?: string | null;
      is_read?: boolean;
    } = {};
    if (data.action === "save") { patch.status = "saved"; patch.saved_at = now; }
    else if (data.action === "unsave") { patch.status = "new"; patch.saved_at = null; }
    else if (data.action === "replied") { patch.status = "replied"; patch.replied_at = now; }
    else if (data.action === "dismiss") { patch.is_read = true; }
    else if (data.action === "reset") { patch.status = "new"; patch.replied_at = null; patch.saved_at = null; }
    else if (data.action === "archive") { patch.status = "archived"; }
    else if (data.action === "unarchive") { patch.status = "new"; }
    const { error } = await supabase.from("inbox_items").update(patch).eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
