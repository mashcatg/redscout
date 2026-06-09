import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AnalyticsResult = {
  totals: { mentions: number; replied: number; saved: number; archived: number; avgScore: number };
  series30: Array<{ date: string; count: number }>;
  entries: Array<{
    id: string;
    created_at: string;
    replied_at: string | null;
    status: string | null;
    relevance_score: number | null;
    keyword_id: string | null;
    subreddit: string | null;
  }>;
  topKeywords: Array<{ keyword: string; count: number; avgScore: number }>;
  topSubreddits: Array<{ name: string; count: number }>;
  topSubreddit: { name: string; count: number } | null;
  topKeyword: { keyword: string; count: number } | null;
  keywordLookup: Array<{ id: string; keyword: string }>;
  keywordSeries: Array<{ keyword: string; points: Array<{ date: string; count: number }> }>;
  heatmap: Array<{ date: string; count: number }>;
};

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i ?? {}))
  .handler(async ({ data, context }): Promise<AnalyticsResult> => {
    const { supabase } = context;
    const yearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();

    const [{ data: items, error }, { data: warmupEng, error: wErr }] = await Promise.all([
      supabase
        .from("inbox_items")
        .select("id, status, relevance_score, created_at, replied_at, keyword_id, subreddit")
        .eq("org_id", data.orgId)
        .neq("status", "archived")
        .is("archived_at", null)
        .gte("created_at", yearAgo),
      supabase
        .from("warmup_engagements")
        .select("id, status, engaged_at")
        .eq("org_id", data.orgId)
        .gte("engaged_at", yearAgo),
    ]);
    if (error) throw new Error(error.message);
    if (wErr) throw new Error(wErr.message);
    const rows = (items ?? []) as Array<{
      id: string; status: string | null; relevance_score: number | null;
      created_at: string; replied_at: string | null;
      keyword_id: string | null; subreddit: string | null;
    }>;
    const warmupRows = (warmupEng ?? []) as Array<{ status: string | null; engaged_at: string | null }>;
    const warmupRepliedCount = warmupRows.filter((w) => w.status === "engaged").length;

    const totals = {
      mentions: rows.length,
      replied: rows.filter((r) => r.status === "replied").length + warmupRepliedCount,
      saved: rows.filter((r) => r.status === "saved").length,
      archived: rows.filter((r) => r.status === "archived").length,
      avgScore: rows.length
        ? Math.round(rows.reduce((s, r) => s + (r.relevance_score ?? 0), 0) / rows.length)
        : 0,
    };


    // 30-day overall series
    const since30 = Date.now() - 30 * 24 * 3600 * 1000;
    const day30Keys: string[] = [];
    const byDay30: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(since30 + i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      day30Keys.push(d);
      byDay30[d] = 0;
    }
    for (const r of rows) {
      const t = new Date(r.created_at).getTime();
      if (t < since30) continue;
      const d = r.created_at.slice(0, 10);
      if (d in byDay30) byDay30[d] = (byDay30[d] ?? 0) + 1;
    }
    const series30 = day30Keys.map((date) => ({ date, count: byDay30[date] ?? 0 }));

    // Heatmap (365 days) — REPLIES per day (inbox replies + warmup engagements)
    const heatMap: Record<string, number> = {};
    for (let i = 0; i < 365; i++) {
      const d = localDateKey(new Date(Date.now() - (364 - i) * 24 * 3600 * 1000));
      heatMap[d] = 0;
    }
    for (const r of rows) {
      if (!r.replied_at) continue;
      const d = localDateKey(new Date(r.replied_at));
      if (d in heatMap) heatMap[d] = (heatMap[d] ?? 0) + 1;
    }
    for (const w of warmupRows) {
      if (w.status !== "engaged" || !w.engaged_at) continue;
      const d = localDateKey(new Date(w.engaged_at));
      if (d in heatMap) heatMap[d] = (heatMap[d] ?? 0) + 1;
    }
    const heatmap = Object.entries(heatMap).map(([date, count]) => ({ date, count }));

    // Top subreddit
    const subCount = new Map<string, number>();
    for (const r of rows) {
      if (!r.subreddit) continue;
      subCount.set(r.subreddit, (subCount.get(r.subreddit) ?? 0) + 1);
    }
    const topSubreddits = Array.from(subCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    let topSubreddit: { name: string; count: number } | null = null;
    for (const [name, count] of subCount.entries()) {
      if (!topSubreddit || count > topSubreddit.count) topSubreddit = { name, count };
    }

    // Top keywords
    const kwIds = Array.from(new Set(rows.map((r) => r.keyword_id).filter((x): x is string => !!x)));
    const kwLabel = new Map<string, string>();
    if (kwIds.length) {
      const { data: kws } = await supabase.from("keywords").select("id, keyword").in("id", kwIds);
      for (const k of (kws ?? []) as Array<{ id: string; keyword: string }>) {
        kwLabel.set(k.id, k.keyword);
      }
    }
    const keywordLookup = Array.from(kwLabel.entries()).map(([id, keyword]) => ({ id, keyword }));
    const kwAgg = new Map<string, { count: number; scoreSum: number }>();
    for (const r of rows) {
      if (!r.keyword_id) continue;
      const cur = kwAgg.get(r.keyword_id) ?? { count: 0, scoreSum: 0 };
      cur.count++;
      cur.scoreSum += r.relevance_score ?? 0;
      kwAgg.set(r.keyword_id, cur);
    }
    const topKeywords = Array.from(kwAgg.entries())
      .map(([id, v]) => ({
        keyword: kwLabel.get(id) ?? "(unknown)",
        count: v.count,
        avgScore: v.count ? Math.round(v.scoreSum / v.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topKeyword = topKeywords[0] ? { keyword: topKeywords[0].keyword, count: topKeywords[0].count } : null;

    // Per-keyword 30-day series for top 5
    const top5 = topKeywords.slice(0, 5);
    const kwIdByLabel = new Map<string, string>();
    for (const [id, label] of kwLabel.entries()) kwIdByLabel.set(label, id);
    const keywordSeries = top5.map((k) => {
      const id = kwIdByLabel.get(k.keyword);
      const buckets: Record<string, number> = {};
      for (const d of day30Keys) buckets[d] = 0;
      for (const r of rows) {
        if (r.keyword_id !== id) continue;
        const t = new Date(r.created_at).getTime();
        if (t < since30) continue;
        const d = r.created_at.slice(0, 10);
        if (d in buckets) buckets[d]++;
      }
      return { keyword: k.keyword, points: day30Keys.map((date) => ({ date, count: buckets[date] ?? 0 })) };
    });

    return { totals, series30, entries: rows, topKeywords, topSubreddits, topSubreddit, topKeyword, keywordLookup, keywordSeries, heatmap };
  });

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
