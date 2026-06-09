import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordApiCall } from "./api-logging";

type LogContext = {
  supabase: unknown;
  userId: string;
};

// ---- Firecrawl scrape ----
export const scrapeWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      url: z.preprocess(
        (v) => typeof v === "string" && v.trim() && !/^https?:\/\//i.test(v.trim()) ? `https://${v.trim()}` : v,
        z.string().url()
      ),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    const logContext: LogContext = { supabase: context.supabase, userId: context.userId };
    const endpoint = "https://api.firecrawl.dev/v1/scrape";
    if (!apiKey) {
      void recordApiCall(logContext.supabase, {
        user_id: logContext.userId,
        org_id: null,
        api_platform: "firecrawl",
        feature: "onboarding",
        operation: "scrape_website",
        endpoint,
        ok: false,
        status_code: 0,
        latency_ms: 0,
        error_message: "FIRECRAWL_API_KEY missing",
        request_meta: { url: data.url },
      });
      throw new Error("FIRECRAWL_API_KEY missing");
    }
    console.log(`[scrapeWebsite] url=${data.url}`);
    try {
      const startedAt = Date.now();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: data.url, formats: ["markdown"], onlyMainContent: true }),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error(`[scrapeWebsite] firecrawl ${res.status}: ${t}`);
        void recordApiCall(logContext.supabase, {
          user_id: logContext.userId,
          org_id: null,
          api_platform: "firecrawl",
          feature: "onboarding",
          operation: "scrape_website",
          endpoint,
          ok: false,
          status_code: res.status,
          latency_ms: Date.now() - startedAt,
          error_message: `Firecrawl ${res.status}`,
          request_meta: { url: data.url },
          response_meta: { body_preview: t.slice(0, 500) },
        });
        return { ok: false as const, error: `Firecrawl ${res.status}` };
      }
      const json: any = await res.json();
      const md: string = json?.data?.markdown ?? json?.markdown ?? "";
      const meta = json?.data?.metadata ?? json?.metadata ?? {};
      const rawTitle: string = meta.title ?? meta.ogTitle ?? "";
      const rawDesc: string = meta.description ?? meta.ogDescription ?? md.slice(0, 400);
      let host = "";
      try { host = new URL(data.url).hostname; } catch {}
      const favicon = host ? `https://www.google.com/s2/favicons?sz=64&domain=${host}` : "";

      // Refine name + description via DeepSeek using scraped content.
      let name = rawTitle || host;
      let description = rawDesc.slice(0, 500);
      try {
        const refined = await refineBrandWithDeepSeek({
          url: data.url,
          host,
          title: rawTitle,
          description: rawDesc,
          markdown: md.slice(0, 6000),
        }, logContext);
        if (refined?.name) name = refined.name;
        if (refined?.description) description = refined.description;
      } catch (e) {
        console.error("[scrapeWebsite] deepseek refine failed", e);
      }

      void recordApiCall(logContext.supabase, {
        user_id: logContext.userId,
        org_id: null,
        api_platform: "firecrawl",
        feature: "onboarding",
        operation: "scrape_website",
        endpoint,
        ok: true,
        status_code: res.status,
        latency_ms: Date.now() - startedAt,
        request_meta: { url: data.url },
        response_meta: { markdown_length: md.length },
      });

      return {
        ok: true as const,
        name,
        description,
        favicon_url: favicon,
        markdown: md.slice(0, 4000),
      };
    } catch (e) {
      console.error("[scrapeWebsite] error", e);
      return { ok: false as const, error: (e as Error).message };
    }
  });

async function refineBrandWithDeepSeek(input: {
  url: string; host: string; title: string; description: string; markdown: string;
}, logContext: LogContext): Promise<{ name: string; description: string } | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const endpoint = "https://api.deepseek.com/v1/chat/completions";
  if (!apiKey) {
    void recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: null,
      api_platform: "deepseek",
      feature: "onboarding",
      operation: "refine_brand",
      endpoint,
      model: "deepseek-chat",
      ok: false,
      status_code: 0,
      latency_ms: 0,
      error_message: "DEEPSEEK_API_KEY missing",
      request_meta: { url: input.url, host: input.host },
    });
    return null;
  }
  const prompt = `Website: ${input.url}
Scraped <title>: ${input.title || "(none)"}
Scraped meta description: ${input.description || "(none)"}

Page content (markdown, truncated):
${input.markdown}

Task:
1. Extract the brand's SHORT product name — what real users call it in conversation (1-3 words). NOT the SEO title. Example: "AI App Builder | Vibe Code Apps & Websites with AI, Fast" -> "Lovable".
2. Write a concise 2-3 sentence product description in plain language: what it does, who it's for, what makes it distinct. No marketing fluff, no superlatives.

Reply ONLY as JSON: {"name":"...","description":"..."}`;
  const startedAt = Date.now();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You extract brand identity from scraped website content. Reply only JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    console.error(`[refineBrandWithDeepSeek] ${res.status}`);
    void recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: null,
      api_platform: "deepseek",
      feature: "onboarding",
      operation: "refine_brand",
      endpoint,
      model: "deepseek-chat",
      ok: false,
      status_code: res.status,
      latency_ms: Date.now() - startedAt,
      error_message: `DeepSeek ${res.status}`,
      request_meta: { url: input.url, host: input.host },
    });
    return null;
  }
  const json: any = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(text);
    const name = typeof parsed.name === "string" ? parsed.name.trim().slice(0, 60) : "";
    const description = typeof parsed.description === "string" ? parsed.description.trim().slice(0, 500) : "";
    if (!name && !description) return null;
    void recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: null,
      api_platform: "deepseek",
      feature: "onboarding",
      operation: "refine_brand",
      endpoint,
      model: "deepseek-chat",
      ok: true,
      status_code: res.status,
      latency_ms: Date.now() - startedAt,
      input_tokens: json.usage?.prompt_tokens ?? null,
      output_tokens: json.usage?.completion_tokens ?? null,
      total_tokens: json.usage?.total_tokens ?? null,
      request_meta: { url: input.url, host: input.host },
      response_meta: { name, description_length: description.length },
    });
    return { name, description };
  } catch {
    return null;
  }
}

// ---- DeepSeek keyword suggestions ----
async function callDeepSeek(brand: string, description: string, kind: "product" | "competitor", logContext: LogContext): Promise<string[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const endpoint = "https://api.deepseek.com/v1/chat/completions";
  if (!apiKey) {
    void recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: null,
      api_platform: "deepseek",
      feature: "onboarding",
      operation: "suggest_keywords",
      endpoint,
      model: "deepseek-chat",
      ok: false,
      status_code: 0,
      latency_ms: 0,
      error_message: "DEEPSEEK_API_KEY missing",
      request_meta: { brand, kind },
    });
    throw new Error("DEEPSEEK_API_KEY missing");
  }
  const prompt = `${kind === "product" ? "Brand" : "Competitor"}: ${brand}
Description: ${description}

Generate EXACTLY 5 short Reddit search keywords (2-4 words each) that ${kind === "product" ? "this brand" : `someone monitoring the competitor "${brand}"`} should track on Reddit.
Focus on buyer-intent, alternatives-to queries, and category problems. No hashtags, no quotes.
Reply ONLY as JSON: {"keywords":["...","..."]}`;
  const startedAt = Date.now();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.6,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You generate Reddit-monitoring keywords. Reply only JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`[suggestKeywords] deepseek ${res.status}: ${t}`);
    void recordApiCall(logContext.supabase, {
      user_id: logContext.userId,
      org_id: null,
      api_platform: "deepseek",
      feature: "onboarding",
      operation: "suggest_keywords",
      endpoint,
      model: "deepseek-chat",
      ok: false,
      status_code: res.status,
      latency_ms: Date.now() - startedAt,
      error_message: `DeepSeek ${res.status}`,
      request_meta: { brand, kind },
      response_meta: { body_preview: t.slice(0, 500) },
    });
    throw new Error(`DeepSeek ${res.status}`);
  }
  const json: any = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text);
  const kws: string[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];
  void recordApiCall(logContext.supabase, {
    user_id: logContext.userId,
    org_id: null,
    api_platform: "deepseek",
    feature: "onboarding",
    operation: "suggest_keywords",
    endpoint,
    model: "deepseek-chat",
    ok: true,
    status_code: res.status,
    latency_ms: Date.now() - startedAt,
    input_tokens: json.usage?.prompt_tokens ?? null,
    output_tokens: json.usage?.completion_tokens ?? null,
    total_tokens: json.usage?.total_tokens ?? null,
    request_meta: { brand, kind },
    response_meta: { keywords: kws.length },
  });
  return kws
    .map((k) => String(k).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5);
}

export const suggestKeywordsGrouped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      productName: z.string().min(1),
      productDescription: z.string().min(1),
      competitors: z.array(z.object({
        name: z.string().min(1),
        description: z.string().default(""),
      })).max(10).default([]),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    console.log(`[suggestKeywordsGrouped] product=${data.productName}`);
    try {
      const product = await callDeepSeek(data.productName, data.productDescription, "product", { supabase: context.supabase, userId: context.userId });
      return { ok: true as const, product, competitors: [] as { name: string; keywords: string[] }[] };
    } catch (e) {
      console.error("[suggestKeywordsGrouped] error", e);
      return {
        ok: false as const,
        product: [] as string[],
        competitors: [] as { name: string; keywords: string[] }[],
        error: (e as Error).message,
      };
    }
  });
