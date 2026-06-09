import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOrgDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    
    const todayKey = localDateKey(new Date());

    const [kw, comp, inbox, recent, replied, lifetimeReplied, sourceCounts] = await Promise.all([
      supabase.from("keywords").select("id", { count: "exact", head: true }).eq("org_id", data.orgId),
      supabase.from("competitors").select("id", { count: "exact", head: true }).eq("org_id", data.orgId),
      supabase
        .from("inbox_items")
        .select("id", { count: "exact", head: true })
        .eq("org_id", data.orgId)
        .neq("status", "archived")
        .is("archived_at", null),
      supabase
        .from("inbox_items")
        .select("id, title, subreddit, status, created_at, relevance_score, reddit_url")
        .eq("org_id", data.orgId)
        .neq("status", "archived")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("inbox_items")
        .select("replied_at, source, competitor_id, keyword_id")
        .eq("org_id", data.orgId)
        .neq("status", "archived")
        .is("archived_at", null)
        .not("replied_at", "is", null)
        .gte("replied_at", since),
      supabase
        .from("inbox_items")
        .select("replied_at, source, competitor_id")
        .eq("org_id", data.orgId)
        .neq("status", "archived")
        .is("archived_at", null)
        .not("replied_at", "is", null),
      supabase
        .from("inbox_items")
        .select("source, competitor_id")
        .eq("org_id", data.orgId),
      supabase
        .from("inbox_items")
        .select("source, competitor_id")
        .eq("org_id", data.orgId)
        .neq("status", "archived")
        .is("archived_at", null),
    ]);

    // 30-day series of new posts
    const { data: series30 } = await supabase
      .from("inbox_items")
      .select("created_at")
      .eq("org_id", data.orgId)
      .neq("status", "archived")
      .is("archived_at", null)
      .gte("created_at", since);

    const byDay: Record<string, number> = {};
    for (const r of (series30 ?? []) as Array<{ created_at: string }>) {
      const d = r.created_at.slice(0, 10);
      byDay[d] = (byDay[d] ?? 0) + 1;
    }
    const series = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

    // Streak = consecutive days (ending today or yesterday) with >=1 reply
    const replyDays = new Set(
      ((replied.data ?? []) as Array<{ replied_at: string }>).map((r) => r.replied_at.slice(0, 10)),
    );
    let streak = 0;
    const day = new Date();
    // allow today/yesterday as start
    if (!replyDays.has(day.toISOString().slice(0, 10))) day.setDate(day.getDate() - 1);
    while (replyDays.has(day.toISOString().slice(0, 10))) {
      streak++;
      day.setDate(day.getDate() - 1);
    }

    const replyRows = (replied.data ?? []) as Array<{
      replied_at: string;
      source: string;
      competitor_id: string | null;
      keyword_id: string | null;
    }>;

    const categories: Array<{
      key: "reddit" | "seo" | "competitor";
      label: string;
      baseline: number;
      matcher: (row: { source: string; competitor_id: string | null; keyword_id: string | null }) => boolean;
    }> = [
      {
        key: "reddit",
        label: "Reddit Inbox replies",
        baseline: 5,
        matcher: (row) => row.source === "sociavault_keyword",
      },
      {
        key: "seo",
        label: "SEO replies",
        baseline: 1,
        matcher: (row) => row.source === "brightdata_serp",
      },
      {
        key: "competitor",
        label: "Competitor replies",
        baseline: 2,
        matcher: (row) => row.source === "sociavault_competitor",
      },
    ];

    const lifetimeRows = (lifetimeReplied.data ?? []) as Array<{
      replied_at: string;
      source: string;
      competitor_id: string | null;
    }>;

    // Longest streak from full reply history (any category)
    const allReplyDays = Array.from(
      new Set(lifetimeRows.map((r) => localDateKey(new Date(r.replied_at)))),
    ).sort();
    let longestStreak = 0;
    let runStreak = 0;
    let prev: string | null = null;
    for (const d of allReplyDays) {
      if (prev) {
        const prevD = new Date(prev);
        prevD.setDate(prevD.getDate() + 1);
        if (localDateKey(prevD) === d) runStreak++;
        else runStreak = 1;
      } else {
        runStreak = 1;
      }
      if (runStreak > longestStreak) longestStreak = runStreak;
      prev = d;
    }

    const availableByCategory = {
      reddit: 0,
      seo: 0,
      competitor: 0,
    };
    for (const row of (sourceCounts.data ?? []) as Array<{ source: string; competitor_id: string | null }>) {
      if (row.source === "brightdata_serp") {
        availableByCategory.seo++;
      } else if (row.source === "sociavault_competitor") {
        availableByCategory.competitor++;
      } else {
        availableByCategory.reddit++;
      }
    }

    const dailyTargets = categories.map((category) => {
      const rows = replyRows.filter(category.matcher);
      const lifetimeRowsCat = lifetimeRows.filter((row) =>
        category.matcher({ source: row.source, competitor_id: row.competitor_id, keyword_id: null }),
      );
      const today = rows.filter((r) => localDateKey(new Date(r.replied_at)) === todayKey).length;
      const history30 = rows.length;
      const activeDays30 = new Set(rows.map((r) => localDateKey(new Date(r.replied_at)))).size;
      const lifetimeReplies = lifetimeRowsCat.length;
      const lifetimeActiveDays = new Set(
        lifetimeRowsCat.map((r) => localDateKey(new Date(r.replied_at))),
      ).size;
      const target = computeDailyTarget({
        baseline: category.baseline,
        lifetimeReplies,
        lifetimeActiveDays,
        longestStreak,
      });
      const available = availableByCategory[category.key];
      const cappedTarget = Math.min(target, available);
      return {
        key: category.key,
        label: category.label,
        today,
        target: cappedTarget,
        available,
        progress: cappedTarget > 0 ? Math.min(100, Math.round((today / cappedTarget) * 100)) : 0,
        history30,
        activeDays30,
      };
    });

    const totalToday = dailyTargets.reduce((sum, target) => sum + target.today, 0);
    const totalTarget = dailyTargets.reduce((sum, target) => sum + target.target, 0);

    return {
      counts: {
        keywords: kw.count ?? 0,
        competitors: comp.count ?? 0,
        inbox: inbox.count ?? 0,
        replied: (replied.data ?? []).length,
      },
      streak,
      series,
      recent: recent.data ?? [],
      dailyTargets,
      dailyTargetSummary: {
        today: totalToday,
        target: totalTarget,
        progress: Math.min(100, Math.round((totalToday / Math.max(totalTarget, 1)) * 100)),
      },
    };
  });

type TargetInput = {
  baseline: number;
  lifetimeReplies: number;
  lifetimeActiveDays: number;
  longestStreak: number;
};

// Ratchet target: grows with lifetime activity, never drops, capped at +15.
function computeDailyTarget({ baseline, lifetimeReplies, lifetimeActiveDays, longestStreak }: TargetInput) {
  const volumeBoost = Math.floor(lifetimeReplies / 40);
  const consistencyBoost = Math.floor(lifetimeActiveDays / 14);
  const streakBoost = Math.floor(longestStreak / 7);
  const target = baseline + volumeBoost + consistencyBoost + streakBoost;
  return Math.min(Math.max(target, baseline), baseline + 15);
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
