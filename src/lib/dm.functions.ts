import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DmDashboardResult = {
  stats: {
    totalSent: number;
    totalQueued: number;
    uniqueUsers: number;
    thisWeek: number;
    draftCampaigns: number;
  };
  campaigns: Array<{
    id: string;
    name: string;
    subreddit: string | null;
    target_username: string | null;
    message_template: string;
    status: string;
    queued_at: string | null;
    sent_at: string | null;
    created_at: string;
  }>;
  messages: Array<{
    id: string;
    campaign_id: string | null;
    reddit_username: string;
    subreddit: string | null;
    reddit_url: string | null;
    message_body: string;
    status: string;
    sent_at: string | null;
    error_message: string | null;
    created_at: string;
  }>;
  activity30: Array<{ date: string; count: number }>;
  topSubreddits: Array<{ name: string; count: number }>;
};

export const getDmDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i ?? {}))
  .handler(async ({ data, context }): Promise<DmDashboardResult> => {
    const supabase = context.supabase as any;

    const [campaignRes, messageRes] = await Promise.all([
      supabase
        .from("dm_campaigns")
        .select("id, name, subreddit, target_username, message_template, status, queued_at, sent_at, created_at")
        .eq("org_id", data.orgId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("dm_message_logs")
        .select("id, campaign_id, reddit_username, subreddit, reddit_url, message_body, status, sent_at, error_message, created_at")
        .eq("org_id", data.orgId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (campaignRes.error) throw new Error(campaignRes.error.message);
    if (messageRes.error) throw new Error(messageRes.error.message);

    const campaigns = (campaignRes.data ?? []) as DmDashboardResult["campaigns"];
    const messages = (messageRes.data ?? []) as DmDashboardResult["messages"];

    const now = Date.now();
    const weekStart = now - 7 * 24 * 3600 * 1000;
    const sentMessages = messages.filter((message) => message.status === "sent");
    const queuedMessages = messages.filter((message) => message.status === "queued");
    const thisWeek = sentMessages.filter((message) => new Date(message.sent_at ?? message.created_at).getTime() >= weekStart).length;
    const uniqueUsers = new Set(sentMessages.map((message) => message.reddit_username.toLowerCase())).size;
    const draftCampaigns = campaigns.filter((campaign) => campaign.status === "draft").length;

    const activityMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date(now - (29 - i) * 24 * 3600 * 1000).toISOString().slice(0, 10);
      activityMap[date] = 0;
    }
    for (const message of sentMessages) {
      const stamp = (message.sent_at ?? message.created_at).slice(0, 10);
      if (stamp in activityMap) activityMap[stamp] += 1;
    }
    const activity30 = Object.entries(activityMap).map(([date, count]) => ({ date, count }));

    const subredditCounts = new Map<string, number>();
    for (const message of sentMessages) {
      if (!message.subreddit) continue;
      subredditCounts.set(message.subreddit, (subredditCounts.get(message.subreddit) ?? 0) + 1);
    }
    const topSubreddits = Array.from(subredditCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      stats: {
        totalSent: sentMessages.length,
        totalQueued: queuedMessages.length,
        uniqueUsers,
        thisWeek,
        draftCampaigns,
      },
      campaigns,
      messages,
      activity30,
      topSubreddits,
    };
  });