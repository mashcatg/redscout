import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPrompt, fillPrompt } from "./prompts.server";

const ROTATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function aiGenerateKeyword(opts: {
  productName: string;
  productDescription: string;
  existing: string[];
  count: 1;
}): Promise<string[]> {
  const tmpl = await getPrompt("seo.hidden_keywords.rotate");
  const prompt = fillPrompt(tmpl, {
    product_name: opts.productName,
    product_description: opts.productDescription,
    existing_keywords: opts.existing.map((k) => `- ${k}`).join("\n") || "(none)",
  });
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "Reply ONLY as JSON. Generate ONE brand-new SEO keyword about the user's product that is NOT in the excluded list, NOT a competitor brand, and NOT previously used. Prefer specific long-tail search phrases real users would Google.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI gateway ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: { keywords?: unknown; keyword?: unknown } = {};
  try { parsed = JSON.parse(raw); } catch { /* */ }
  const arr = Array.isArray(parsed.keywords)
    ? (parsed.keywords as unknown[]).map(String)
    : typeof parsed.keyword === "string"
      ? [parsed.keyword]
      : [];
  const seen = new Set(opts.existing.map((s) => s.toLowerCase()));
  return arr.map((s) => s.trim()).filter((s) => s && !seen.has(s.toLowerCase())).slice(0, opts.count);
}

type SerpHit = {
  reddit_post_id: string;
  reddit_url: string;
  title: string;
  body: string | null;
  position: number;
};

async function brightdataSerp(keyword: string): Promise<SerpHit[]> {
  const key = process.env.BRIGHTDATA_API_KEY;
  if (!key) return [];
  const url =
    "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_mfz5x93lmsjjjylob&custom_output_fields=organic";
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      { url: "https://www.google.com/", keyword, country: "US", language: "en", start_page: 1, end_page: 10, include_paginated_html: false },
    ]),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[seo] brightdata ${res.status}: ${text.slice(0, 200)}`);
    return [];
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return []; }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const re = /reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/i;
  const out: SerpHit[] = [];
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
  const seen = new Set<string>();
  const dedup: SerpHit[] = [];
  for (const h of out.sort((a, b) => (a.position ?? 999) - (b.position ?? 999))) {
    const id = h.reddit_post_id.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    dedup.push(h);
  }
  return dedup;
}

async function scoreHit(hit: SerpHit, productName: string, productDescription: string): Promise<{ score: number | null; reason: string | null }> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { score: null, reason: null };
  try {
    const prompt = `You score Reddit posts for marketing relevance to a product.

Product: ${productName}
Product description: ${productDescription}

Reddit post title: ${hit.title}
Reddit post body: ${(hit.body ?? "").slice(0, 1500)}

Return JSON: {"score": <0-100 integer>, "reason": "<short one-sentence reason>"}.`;
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
    if (!res.ok) return { score: null, reason: null };
    const j = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = j.choices?.[0]?.message?.content;
    if (!content) return { score: null, reason: null };
    const parsed = JSON.parse(content) as { score?: number; reason?: string };
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score ?? 0))));
    return { score, reason: parsed.reason ?? null };
  } catch {
    return { score: null, reason: null };
  }
}

async function processOrg(orgId: string) {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("product_name, product_description, name")
    .eq("id", orgId)
    .single();
  if (!org) return { ok: false, error: "org not found" };

  // Build the FULL exclusion list: existing hidden keywords + user keywords + competitor names.
  const [{ data: hiddenRows }, { data: kwRows }, { data: compRows }] = await Promise.all([
    supabaseAdmin.from("seo_hidden_keywords").select("keyword").eq("org_id", orgId),
    supabaseAdmin.from("keywords").select("keyword").eq("org_id", orgId),
    supabaseAdmin.from("competitors").select("name").eq("org_id", orgId),
  ]);
  const existing = [
    ...(hiddenRows ?? []).map((r) => r.keyword as string),
    ...(kwRows ?? []).map((r) => r.keyword as string),
    ...(compRows ?? []).map((r) => r.name as string),
  ].filter(Boolean);

  const keywords = await aiGenerateKeyword({
    productName: org.product_name ?? org.name ?? "Product",
    productDescription: org.product_description ?? "",
    existing,
    count: 1,
  });
  if (keywords.length === 0) {
    // Still bump schedule so we don't spin every minute.
    await supabaseAdmin.from("seo_keyword_schedule").upsert({
      org_id: orgId, seeded: true,
      next_run_at: new Date(Date.now() + ROTATE_INTERVAL_MS).toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { ok: true, inserted: 0, hits: 0 };
  }
  const keyword = keywords[0];

  // Persist the new hidden keyword.
  const { data: hiddenIns } = await supabaseAdmin
    .from("seo_hidden_keywords")
    .upsert(
      [{ org_id: orgId, keyword, last_used_at: new Date().toISOString() }],
      { onConflict: "org_id,keyword", ignoreDuplicates: false },
    )
    .select("id, keyword")
    .single();

  // Immediately scrape BrightData SERP + score + upsert into inbox.
  const hits = await brightdataSerp(keyword);
  let inserted = 0;
  if (hits.length) {
    const scored = await Promise.all(
      hits.slice(0, 25).map(async (h) => ({ ...h, ...(await scoreHit(h, org.product_name ?? "Product", org.product_description ?? "")) })),
    );
    const rows = scored.map((h) => ({
      org_id: orgId,
      source: "brightdata_serp",
      hidden_keyword_id: hiddenIns?.id ?? null,
      reddit_post_id: h.reddit_post_id,
      reddit_url: h.reddit_url,
      title: h.title,
      body: h.body,
      google_position: h.position,
      serp_keyword: keyword,
      relevance_score: h.score,
      score_reason: h.reason,
    }));
    const { count } = await supabaseAdmin
      .from("inbox_items")
      .upsert(rows, { onConflict: "org_id,reddit_post_id", ignoreDuplicates: true, count: "exact" });
    inserted = count ?? 0;
  }

  await supabaseAdmin.from("seo_keyword_schedule").upsert({
    org_id: orgId,
    seeded: true,
    next_run_at: new Date(Date.now() + ROTATE_INTERVAL_MS).toISOString(),
    updated_at: new Date().toISOString(),
  });

  return { ok: true, inserted, hits: hits.length, keyword };
}

export async function runSeoRotateAll() {
  const now = new Date().toISOString();
  const { data: orgs } = await supabaseAdmin.from("organizations").select("id");
  const { data: scheds } = await supabaseAdmin.from("seo_keyword_schedule").select("org_id, next_run_at, seeded");
  const schedMap = new Map((scheds ?? []).map((s) => [s.org_id as string, s]));
  const results: Array<{ orgId: string; ok: boolean; inserted?: number; hits?: number; error?: string }> = [];
  for (const o of orgs ?? []) {
    const sched = schedMap.get(o.id as string);
    const due = !sched || (sched.next_run_at && sched.next_run_at <= now);
    if (!due) continue;
    try {
      const r = await processOrg(o.id as string);
      results.push({ orgId: o.id as string, ...r });
    } catch (e) {
      results.push({ orgId: o.id as string, ok: false, error: (e as Error).message });
    }
  }
  return results;
}

export const triggerSeoRotate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => processOrg(data.orgId));
