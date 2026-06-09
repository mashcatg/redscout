import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Inbox, Tag, Swords, CheckCheck, ExternalLink, Flame } from "lucide-react";
import BrandIcon from "@/components/BrandIcon";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { getOrgDashboard } from "@/lib/dashboard.functions";
import { getAnalytics } from "@/lib/analytics.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { StreakHeatmap } from "@/components/StreakHeatmap";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/overview")({
  component: Overview,
});

function Overview() {
  const { orgId } = Route.useParams();
  const fn = useServerFn(getOrgDashboard);
  const analyticsFn = useServerFn(getAnalytics);
  const q = useQuery({ queryKey: ["org-dashboard", orgId], queryFn: () => fn({ data: { orgId } }), refetchInterval: 30000 });
  const aQ = useQuery({ queryKey: ["analytics-heat", orgId], queryFn: () => analyticsFn({ data: { orgId } }) });

  return (
    <div className="p-6 md:p-8 w-full">

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your activity, streak and performance.</p>
      </div>

      {q.isLoading || !q.data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Streak" value={`${q.data.streak} day${q.data.streak === 1 ? "" : "s"}`} icon={Flame} accent />
            <StatCard label="Replies (30d)" value={q.data.counts.replied} icon={CheckCheck} />
            <StatCard label="Posts scanned" value={q.data.counts.inbox} icon={Inbox} />
            <StatCard label="Keywords / Competitors" value={`${q.data.counts.keywords} / ${q.data.counts.competitors}`} icon={Tag} />
          </div>

          <div className="border border-border/70 rounded-lg p-4 mb-6 bg-muted/15">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold">Daily targets</h2>
                <p className="text-xs text-muted-foreground mt-1">Targets adapt to 30-day volume, 7-day momentum, streak, and category history.</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall</div>
                <div className="text-sm font-semibold">{q.data.dailyTargetSummary.today} / {q.data.dailyTargetSummary.target}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <TargetCard label="Overall" today={q.data.dailyTargetSummary.today} target={q.data.dailyTargetSummary.target} progress={q.data.dailyTargetSummary.progress} accent />
              {q.data.dailyTargets.map((target) => (
                <TargetCard
                  key={target.key}
                  label={target.label}
                  today={target.today}
                  target={target.target}
                  progress={target.progress}
                  hint={`${target.history30} replies in 30d · ${target.activeDays30} active days`}
                />
              ))}
            </div>
          </div>

          <div className="mb-6">
            
            {aQ.data ? (
              <StreakHeatmap
                data={aQ.data.heatmap}
                target={q.data.dailyTargetSummary.target}
                streak={q.data.streak}
                fullWidth
                className="w-full"
              />
            ) : (
              <Skeleton className="h-24" />
            )}
          </div>

          <div className="border border-border rounded-lg p-4 mb-6">
            <h2 className="font-semibold mb-3">New posts — last 30 days</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={q.data.series}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-3">Recent activity</h2>
            <div className="divide-y divide-border">
              {q.data.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No activity yet — add keywords to start scanning.</p>
              ) : q.data.recent.map((r) => (
                <a key={r.id} href={r.reddit_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-2.5 group">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium group-hover:underline">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground">r/{r.subreddit} · {new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  {r.relevance_score != null && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">{r.relevance_score}</span>
                  )}
                  <Swords className="hidden" />
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; accent?: boolean }) {
  return (
    <div className={`border rounded-lg p-4 ${accent ? "border-primary/40 bg-primary/5" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function TargetCard({
  label,
  today,
  target,
  progress,
  hint,
  accent,
}: {
  label: string;
  today: number;
  target: number;
  progress: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-4 ${accent ? "border-primary/40 bg-primary/5" : "border-border/70 bg-muted/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{today} / {target}</span>
      </div>
      <div className="mt-3">
        <Progress value={progress} className={accent ? "h-2 bg-primary/15" : "h-2"} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{progress}% complete</span>
        <span>{Math.max(target - today, 0)} remaining</span>
      </div>
      {hint && <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
