import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Chrome, CalendarDays, MessageSquare, Send, Sparkles, Target, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getDmDashboard } from "@/lib/dm.functions";



export const Route = createFileRoute("/_authenticated/dashboard/$orgId/dm")({
  component: DmPage,
});

const MESSAGE_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

function DmPage() {
  const { orgId } = Route.useParams();
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [granularity, setGranularity] = useState<"day" | "week">("day");
  const fn = useServerFn(getDmDashboard);
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["dm-dashboard", orgId], queryFn: () => fn({ data: { orgId } }), refetchInterval: 30000 });

  // Live sync from the extension: any insert/update on dm_message_logs or
  // dm_campaigns for this org invalidates the dashboard query.
  useEffect(() => {
    const channel = supabase
      .channel(`dm-live-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_message_logs", filter: `org_id=eq.${orgId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["dm-dashboard", orgId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_campaigns", filter: `org_id=eq.${orgId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["dm-dashboard", orgId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);

  const dashboard = q.data;

  const activity = useMemo(() => buildActivity(dashboard?.messages ?? [], range, granularity), [dashboard, range, granularity]);
  const topSubreddits = dashboard?.topSubreddits ?? [];

  const dmQuota = {
    used: dashboard?.stats.totalSent ?? 0,
    total: Math.max((dashboard?.stats.totalSent ?? 0) + (dashboard?.stats.totalQueued ?? 0) + 10, 30),
  };

  const noData = !dashboard || activity.every((row) => row.count === 0);

  return (
    <div className="w-full px-6 py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DMs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live DM campaigns and message logs from the Chrome extension</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Chrome className="h-4 w-4 text-orange-500" /> redScout Chrome Extension
            </div>
            <p className="text-xs text-amber-700">Auto-DM Reddit thread commenters</p>
          </div>
          <Button
            size="sm"
            className="bg-orange-500 text-white hover:bg-orange-600"
            onClick={() => {
              fetch("/redscout-extension.zip")
                .then((res) => {
                  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
                  return res.blob();
                })
                .then((blob) => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "redscout-extension.zip";
                  a.click();
                  URL.revokeObjectURL(a.href);
                })
                .catch((err) => alert(err.message));
            }}
          >
            Download <Send className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={range} onValueChange={(value) => setRange(value as typeof range)}>
          <SelectTrigger className="w-[150px]">
            <CalendarDays className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Last 30 days" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={granularity} onValueChange={(value) => setGranularity(value as "day" | "week")}> 
          <SelectTrigger className="w-[130px]">
            <RefreshCw className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder={granularity === "day" ? "Per day" : "Per week"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Per day</SelectItem>
            <SelectItem value="week">Per week</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard label="Total Sent" value={dashboard?.stats.totalSent ?? 0} icon={<Send className="h-4 w-4 text-orange-500" />} />
            <MetricCard label="Queued" value={dashboard?.stats.totalQueued ?? 0} icon={<Sparkles className="h-4 w-4 text-emerald-500" />} />
            <MetricCard label="Unique Users" value={dashboard?.stats.uniqueUsers ?? 0} icon={<Users className="h-4 w-4 text-violet-500" />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <section className="rounded-2xl border border-border/70 bg-muted/10 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" /> Message Activity
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">Tracks extension-sent DMs over time.</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div className="uppercase tracking-wide">This week</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">{dashboard?.stats.thisWeek ?? 0} sent</div>
                </div>
              </div>

              <div className="mt-6 h-[18rem]">
                {noData ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No messages in this period</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activity} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dmFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2.5} fill="url(#dmFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-muted/10 p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Target className="h-4 w-4 text-muted-foreground" /> Top Subreddits
              </h2>
              <div className="mt-6 h-[18rem]">
                {topSubreddits.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSubreddits} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} hide />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f97316" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>

          <section id="dm-campaigns" className="rounded-[28px] border border-dashed border-orange-300/70 bg-orange-500/8 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Campaigns synced from the extension</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  The extension writes drafts and sent logs to Supabase. Use this panel to review what was queued, sent, or left in draft.
                </p>
              </div>
              <div className="rounded-2xl border border-orange-200 bg-white/40 px-4 py-3 text-right">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Quota</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{dmQuota.used} / {dmQuota.total}</div>
              </div>
            </div>

            <Progress value={Math.min((dmQuota.used / Math.max(dmQuota.total, 1)) * 100, 100)} className="mt-5 h-2 bg-orange-100" />

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Campaigns</h3>
                  <div className="text-xs text-muted-foreground">{dashboard?.stats.draftCampaigns ?? 0} drafts</div>
                </div>
                <div className="mt-4 space-y-3">
                  {(dashboard?.campaigns ?? []).length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No campaigns saved yet.</p>
                  ) : (
                    dashboard!.campaigns.slice(0, 6).map((campaign) => (
                      <div key={campaign.id} className="rounded-xl border border-border/60 bg-muted/10 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{campaign.name}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {campaign.subreddit ? `r/${campaign.subreddit}` : "No subreddit set"}
                              {campaign.target_username ? ` · u/${campaign.target_username}` : ""}
                            </div>
                          </div>
                          <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-600">
                            {campaign.status}
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{campaign.message_template}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                <h3 className="font-semibold">Recent message logs</h3>
                <div className="mt-4 space-y-3">
                  {(dashboard?.messages ?? []).length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No sent messages yet.</p>
                  ) : (
                    dashboard!.messages.slice(0, 6).map((message, index) => (
                      <div key={message.id} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 p-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10 text-sm font-bold text-orange-600">
                          {message.reddit_username.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate font-medium">u/{message.reddit_username}</div>
                            <span className="text-[11px] text-muted-foreground">
                              {message.status}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {message.subreddit ? `r/${message.subreddit}` : "No subreddit"}
                            {message.sent_at ? ` · ${new Date(message.sent_at).toLocaleDateString()}` : ""}
                          </div>
                          <div className="mt-2 line-clamp-2 text-sm text-foreground/90">{message.message_body}</div>
                        </div>
                        <div className="hidden h-2.5 w-2.5 rounded-full bg-[color:var(--message-color)]" style={{ ["--message-color" as string]: MESSAGE_COLORS[index % MESSAGE_COLORS.length] }} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/10 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
      <Progress value={Math.min(value * 5, 100)} className="mt-3 h-2 bg-border/60" />
    </div>
  );
}

function buildActivity(messages: Array<{ status: string; sent_at: string | null; created_at: string }>, range: "7d" | "30d" | "90d", granularity: "day" | "week") {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const now = new Date();
  const rows: Array<{ label: string; count: number }> = [];

  if (granularity === "week") {
    const weeks = Math.max(1, Math.ceil(days / 7));
    for (let i = 0; i < weeks; i++) {
      const start = new Date(now);
      start.setDate(now.getDate() - (weeks - 1 - i) * 7);
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() - 6);
      const weekKey = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
      const startTime = weekStart.getTime();
      const endTime = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999).getTime();
      const count = messages.filter((message) => {
        const stamp = new Date(message.sent_at ?? message.created_at).getTime();
        return stamp >= startTime && stamp <= endTime && message.status === "sent";
      }).length;
      rows.push({ label: weekKey, count });
    }
    return rows;
  }

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - 1 - i));
    const label = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
    const dayKey = date.toISOString().slice(0, 10);
    const count = messages.filter((message) => {
      if (message.status !== "sent") return false;
      const stamp = (message.sent_at ?? message.created_at).slice(0, 10);
      return stamp === dayKey;
    }).length;
    rows.push({ label, count });
  }
  return rows;
}