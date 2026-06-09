import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ArrowUpRight,
  CalendarDays,
  Download,
  Filter,
  Hash,
  LineChart as LineChartIcon,
  BarChart3,
  MessageSquare,
  PieChart as PieChartIcon,
  Target,
  Trophy,
} from "lucide-react";
import { getAnalytics } from "@/lib/analytics.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StreakHeatmap } from "@/components/StreakHeatmap";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/analytics")({
  component: AnalyticsPage,
});

type TabValue = "overview" | "keywords";
type RangeValue = "7d" | "30d" | "90d" | "365d";
type StatusFilter = "all" | "new" | "replied" | "saved" | "archived";
type ScoreFilter = "all" | "90" | "80" | "70" | "60";
type Granularity = "day" | "week";
type OverviewMode = "trend" | "subreddits" | "keywords";

const LINE_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
const ANALYTICS_COLORS = ["#f97316", "#fb923c", "#ea580c", "#fdba74", "#c2410c"];

function AnalyticsPage() {
  const { orgId } = Route.useParams();
  const fn = useServerFn(getAnalytics);
  const q = useMemo(() => fn({ data: { orgId } }), [fn, orgId]);

  // useServerFn returns a function, so wire it through a query-style memoized promise only once loaded.
  // The query lives in a tiny wrapper to keep the route simple and predictable.
  const [dataState, setDataState] = useState<Awaited<ReturnType<typeof fn>> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void q
      .then((data) => {
        if (!alive) return;
        setDataState(data);
      })
      .catch(() => {
        if (!alive) return;
        setDataState(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [q]);

  const data = dataState;
  const [tab, setTab] = useState<TabValue>("overview");
  const [range, setRange] = useState<RangeValue>("30d");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("trend");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [focusedKeywordIds, setFocusedKeywordIds] = useState<string[]>([]);

  const keywordLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of data?.keywordLookup ?? []) map.set(item.id, item.keyword);
    return map;
  }, [data]);

  const filteredEntries = useMemo(() => {
    const entries = data?.entries ?? [];
    const since = new Date(Date.now() - rangeToDays(range) * 24 * 60 * 60 * 1000);
    return entries.filter((entry) => {
      const created = new Date(entry.created_at);
      if (created < since) return false;
      if (statusFilter !== "all" && entry.status !== statusFilter) return false;
      if (scoreFilter !== "all") {
        const score = entry.relevance_score ?? 0;
        if (score < Number(scoreFilter)) return false;
      }
      return true;
    });
  }, [data, range, scoreFilter, statusFilter]);

  const keywordStats = useMemo(() => buildKeywordStats(filteredEntries, keywordLookup), [filteredEntries, keywordLookup]);
  const subredditStats = useMemo(() => buildSubredditStats(filteredEntries), [filteredEntries]);

  useEffect(() => {
    setFocusedKeywordIds((current) => current.filter((id) => keywordStats.some((row) => row.id === id)));
  }, [keywordStats]);

  const overviewSeries = useMemo(() => buildTimelineSeries(filteredEntries, range, granularity), [filteredEntries, granularity, range]);
  const subredditChartSeries = useMemo(() => subredditStats.slice(0, 5).map((row) => ({ key: row.key, label: row.name })), [subredditStats]);
  const subredditChart = useMemo(() => buildMultiSeries(filteredEntries, subredditChartSeries, range, granularity, (row) => row.subreddit ?? ""), [filteredEntries, granularity, range, subredditChartSeries]);
  const focusedKeywordSeries = useMemo(() => {
    const selected = focusedKeywordIds.length > 0
      ? keywordStats.filter((row) => focusedKeywordIds.includes(row.id))
      : keywordStats.slice(0, 5);
    return selected.length > 0 ? selected : keywordStats.slice(0, 5);
  }, [focusedKeywordIds, keywordStats]);
  const keywordChartRows = useMemo(() => buildMultiSeries(filteredEntries, focusedKeywordSeries, range, granularity, (row) => row.keyword_id ?? ""), [filteredEntries, focusedKeywordSeries, granularity, range]);

  const topKeyword = keywordStats[0] ?? null;
  const topSubreddit = subredditStats[0] ?? null;
  const topSubredditPie = subredditStats.slice(0, 6);
  const topKeywordPie = keywordStats.slice(0, 6);

  const totals = useMemo(() => {
    const mentions = filteredEntries.length;
    const replied = filteredEntries.filter((entry) => entry.status === "replied").length;
    const saved = filteredEntries.filter((entry) => entry.status === "saved").length;
    const archived = filteredEntries.filter((entry) => entry.status === "archived").length;
    const avgScore = mentions
      ? Math.round(filteredEntries.reduce((sum, entry) => sum + (entry.relevance_score ?? 0), 0) / mentions)
      : 0;
    return { mentions, replied, saved, archived, avgScore };
  }, [filteredEntries]);

  function exportCsv() {
    if (!filteredEntries.length) return;
    const rows = [
      ["created_at", "status", "subreddit", "keyword", "score"],
      ...filteredEntries.map((entry) => [
        entry.created_at,
        entry.status ?? "",
        entry.subreddit ?? "",
        entry.keyword_id ? keywordLookup.get(entry.keyword_id) ?? entry.keyword_id : "",
        String(entry.relevance_score ?? ""),
      ]),
    ];

    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${orgId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !data) {
    return (
      <div className="w-full px-6 py-6 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-[24rem] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">Analytics and insights from your Reddit opportunities</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filteredEntries.length}>
          <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={range} onValueChange={(value) => setRange(value as RangeValue)}>
          <SelectTrigger className="w-[150px]">
            <CalendarDays className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Last 30 days" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="365d">Last 12 months</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="w-[140px]">
            <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="saved">Saved</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={scoreFilter} onValueChange={(value) => setScoreFilter(value as ScoreFilter)}>
          <SelectTrigger className="w-[140px]">
            <Target className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="All scores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scores</SelectItem>
            <SelectItem value="90">90+ score</SelectItem>
            <SelectItem value="80">80+ score</SelectItem>
            <SelectItem value="70">70+ score</SelectItem>
            <SelectItem value="60">60+ score</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
        <TabsList className="bg-muted/40">
          <TabsTrigger value="overview" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="keywords" className="gap-1.5">
            <Hash className="h-3.5 w-3.5" /> Keywords
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <MetricCard label="Total Posts" value={totals.mentions} icon={<MessageSquare className="h-5 w-5 text-primary" />} />
            <MetricCard label="Avg. Relevance" value={totals.avgScore} icon={<Target className="h-5 w-5 text-emerald-500" />} />
            <MetricCard
              label="Top Subreddit"
              value={topSubreddit ? `r/${topSubreddit.name}` : "—"}
              hint={topSubreddit ? `${topSubreddit.count} posts` : undefined}
              icon={<Trophy className="h-5 w-5 text-amber-500" />}
            />
            <MetricCard
              label="Top Keyword"
              value={topKeyword?.label ?? "—"}
              hint={topKeyword ? `${topKeyword.total} mentions` : undefined}
              icon={<Hash className="h-5 w-5 text-orange-500" />}
            />
          </div>

          <section className="rounded-2xl border border-border/70 bg-muted/10 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" /> Activity
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">Switch chart mode to inspect overall activity, subreddit mix, or keyword coverage.</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={granularity} onValueChange={(value) => setGranularity(value as Granularity)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Per day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Per day</SelectItem>
                    <SelectItem value="week">Per week</SelectItem>
                  </SelectContent>
                </Select>
                <ToggleGroup type="single" value={overviewMode} onValueChange={(value) => value && setOverviewMode(value as OverviewMode)} variant="outline" size="sm" aria-label="Chart mode">
                  <ToggleGroupItem value="trend" aria-label="Trend">
                    <LineChartIcon className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="subreddits" aria-label="Subreddits">
                    <PieChartIcon className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="keywords" aria-label="Keywords">
                    <Hash className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            <div className="mt-6 h-[19rem]">
              {overviewMode === "trend" && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overviewSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatChartLabel} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip labelFormatter={formatChartLabel} />
                    <Area type="monotone" dataKey="count" stroke="var(--analytics-orange-1)" strokeWidth={2.5} fill="url(#activityFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {overviewMode === "subreddits" && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subredditChart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatChartLabel} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip labelFormatter={formatChartLabel} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {subredditChartSeries.map((row, index) => (
                      <Bar key={row.key} dataKey={row.key} name={row.label} stackId="mix" fill={ANALYTICS_COLORS[index % ANALYTICS_COLORS.length]} radius={index === 0 ? [4, 4, 0, 0] : 0} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}

              {overviewMode === "keywords" && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={keywordChartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatChartLabel} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip labelFormatter={formatChartLabel} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {focusedKeywordSeries.map((row, index) => (
                      <Line key={row.key} type="monotone" dataKey={row.key} name={row.label} stroke={ANALYTICS_COLORS[index % ANALYTICS_COLORS.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <SummaryDonutCard
              title="Subreddits"
              icon={<PieChartIcon className="h-4 w-4 text-orange-500" />}
              total={totals.mentions}
              totalLabel="posts"
              rows={topSubredditPie.map((row, index) => ({ label: `r/${row.name}`, value: row.count, color: ANALYTICS_COLORS[index % ANALYTICS_COLORS.length] }))}
              detailsLabel="Details"
              onDetails={() => setTab("keywords")}
            />
            <SummaryDonutCard
              title="Keywords"
              icon={<Hash className="h-4 w-4 text-orange-500" />}
              total={keywordStats.reduce((sum, row) => sum + row.total, 0)}
              totalLabel="mentions"
              rows={topKeywordPie.map((row, index) => ({ label: row.label, value: row.total, color: ANALYTICS_COLORS[index % ANALYTICS_COLORS.length] }))}
              detailsLabel="Details"
              onDetails={() => setTab("keywords")}
            />
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/10 p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Activity heatmap</h2>
                <p className="mt-1 text-xs text-muted-foreground">Last 12 months of reply activity.</p>
              </div>
              <span className="text-xs text-muted-foreground">{data.heatmap.length} days tracked</span>
            </div>
            <StreakHeatmap data={data.heatmap} fullWidth className="w-full" />
          </div>
        </TabsContent>

        <TabsContent value="keywords" className="mt-6 space-y-6">
          <section className="rounded-2xl border border-border/70 bg-muted/10 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Hash className="h-4 w-4 text-muted-foreground" /> Keyword Activity
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">Click rows to add or remove keywords from focus. Double click removes one keyword immediately.</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={granularity} onValueChange={(value) => setGranularity(value as Granularity)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Per day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Per day</SelectItem>
                    <SelectItem value="week">Per week</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setFocusedKeywordIds([])} disabled={focusedKeywordIds.length === 0}>
                  Clear focus
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Focused keywords</span>
              {focusedKeywordSeries.length > 0 ? (
                focusedKeywordSeries.map((row, index) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => toggleFocusedKeyword(row.id, setFocusedKeywordIds)}
                    onDoubleClick={() => clearFocusedKeyword(row.id, setFocusedKeywordIds)}
                    className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-500/15"
                    title="Click to toggle, double click to remove"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LINE_COLORS[index % LINE_COLORS.length] }} />
                    {row.label}
                  </button>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Showing top keyword activity automatically.</span>
              )}
            </div>

            <div className="mt-6 h-[20rem]">
              {keywordChartRows.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No keyword activity yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={keywordChartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatChartLabel} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip labelFormatter={formatChartLabel} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {focusedKeywordSeries.map((row, index) => (
                      <Line key={row.key} type="monotone" dataKey={row.key} name={row.label} stroke={LINE_COLORS[index % LINE_COLORS.length]} strokeWidth={2.4} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-muted/10 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Keyword Performance</h2>
                <p className="mt-1 text-xs text-muted-foreground">Click a row to filter the chart.</p>
              </div>
              <div className="text-xs text-muted-foreground">Top {keywordStats.length} keywords in range</div>
            </div>

            {keywordStats.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">No keyword activity yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold">Keyword</th>
                      <th className="px-5 py-3 text-right font-semibold">Total</th>
                      <th className="px-5 py-3 text-right font-semibold">Replied</th>
                      <th className="px-5 py-3 text-right font-semibold">Saved</th>
                      <th className="px-5 py-3 text-right font-semibold">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {keywordStats.map((row) => {
                      const active = focusedKeywordIds.includes(row.id);
                      return (
                        <tr
                          key={row.id}
                          onClick={() => toggleFocusedKeyword(row.id, setFocusedKeywordIds)}
                          onDoubleClick={() => clearFocusedKeyword(row.id, setFocusedKeywordIds)}
                          className={`cursor-pointer transition-colors hover:bg-muted/40 ${active ? "bg-orange-500/5" : ""}`}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                              <span className="max-w-[34ch] truncate font-medium" title={row.label}>{row.label}</span>
                              {active && <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-700">Focused</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold tabular-nums">{row.total}</td>
                          <td className="px-5 py-3 text-right tabular-nums">{row.replied}</td>
                          <td className="px-5 py-3 text-right tabular-nums">{row.saved}</td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            <span className={row.avgScore >= 80 ? "text-orange-600 font-semibold" : row.avgScore >= 60 ? "text-amber-600" : "text-muted-foreground"}>{row.avgScore}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ label, value, hint, icon }: { label: string; value: string | number; hint?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/10 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-2xl font-bold tabular-nums truncate">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function SummaryDonutCard({
  title,
  icon,
  total,
  totalLabel,
  rows,
  detailsLabel,
  onDetails,
}: {
  title: string;
  icon: React.ReactNode;
  total: number;
  totalLabel: string;
  rows: Array<{ label: string; value: number; color: string }>;
  detailsLabel: string;
  onDetails: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/10 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="text-orange-500">{icon}</span> {title}
        </div>
        <button type="button" onClick={onDetails} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowUpRight className="h-3.5 w-3.5" /> {detailsLabel}
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr]">
        <div className="relative flex h-40 items-center justify-center">
          {rows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="value" nameKey="label" innerRadius={48} outerRadius={70} stroke="none" paddingAngle={2}>
                  {rows.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-full border border-dashed border-border/70 px-6 text-xs text-muted-foreground">No data</div>
          )}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="text-2xl font-bold tabular-nums">{total}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{totalLabel}</div>
          </div>
        </div>
        <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data in this range.</p>
          ) : (
            rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="truncate" title={row.label}>{row.label}</span>
                </div>
                <span className="text-muted-foreground tabular-nums">{row.value}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function buildKeywordStats(
  entries: Array<{ keyword_id: string | null; status: string | null; relevance_score: number | null }>,
  keywordLookup: Map<string, string>,
) {
  const map = new Map<string, { total: number; replied: number; saved: number; scoreSum: number }>();
  for (const entry of entries) {
    if (!entry.keyword_id) continue;
    const cur = map.get(entry.keyword_id) ?? { total: 0, replied: 0, saved: 0, scoreSum: 0 };
    cur.total += 1;
    if (entry.status === "replied") cur.replied += 1;
    if (entry.status === "saved") cur.saved += 1;
    cur.scoreSum += entry.relevance_score ?? 0;
    map.set(entry.keyword_id, cur);
  }

  return Array.from(map.entries())
    .map(([id, row]) => ({
      id,
      label: keywordLookup.get(id) ?? id,
      key: id,
      total: row.total,
      replied: row.replied,
      saved: row.saved,
      avgScore: row.total ? Math.round(row.scoreSum / row.total) : 0,
      color: ANALYTICS_COLORS[0],
    }))
    .sort((a, b) => b.total - a.total)
    .map((row, index) => ({ ...row, color: ANALYTICS_COLORS[index % ANALYTICS_COLORS.length] }));
}

function buildSubredditStats(entries: Array<{ subreddit: string | null }>) {
  const map = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.subreddit) continue;
    map.set(entry.subreddit, (map.get(entry.subreddit) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, key: name, count }))
    .sort((a, b) => b.count - a.count);
}

function buildTimelineSeries(
  entries: Array<{ created_at: string }>,
  range: RangeValue,
  granularity: Granularity,
) {
  const buckets = makeBuckets(range, granularity);
  for (const entry of entries) {
    const key = bucketDate(entry.created_at, granularity);
    if (key in buckets) buckets[key] += 1;
  }
  return Object.entries(buckets).map(([label, count]) => ({ label, count }));
}

function buildMultiSeries<T extends { created_at: string }>(
  entries: Array<T & Record<string, unknown>>,
  series: Array<{ key: string; label: string }>,
  range: RangeValue,
  granularity: Granularity,
  accessor: (entry: T) => string,
) {
  const buckets = makeBuckets(range, granularity);
  const data = Object.entries(buckets).map(([label]) => ({ label, ...Object.fromEntries(series.map((item) => [item.key, 0])) }));
  const indexByLabel = new Map<string, number>(data.map((row, index) => [row.label, index]));

  for (const entry of entries as T[]) {
    const key = accessor(entry);
    if (!key || !series.some((item) => item.key === key)) continue;
    const label = bucketDate(entry.created_at, granularity);
    const index = indexByLabel.get(label);
    if (index == null) continue;
    const row = data[index] as Record<string, unknown>;
    row[key] = Number(row[key] ?? 0) + 1;
  }

  return data;
}

function makeBuckets(range: RangeValue, granularity: Granularity) {
  const days = rangeToDays(range);
  const buckets: Record<string, number> = {};
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  if (granularity === "day") {
    for (let i = 0; i <= days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      buckets[dateKey(date)] = 0;
    }
  } else {
    let cursor = startOfWeek(start);
    const end = startOfWeek(new Date());
    while (cursor <= end) {
      buckets[dateKey(cursor)] = 0;
      cursor = addDays(cursor, 7);
    }
  }
  return buckets;
}

function bucketDate(iso: string, granularity: Granularity) {
  const date = new Date(iso);
  return granularity === "day" ? dateKey(date) : dateKey(startOfWeek(date));
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function rangeToDays(range: RangeValue) {
  switch (range) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
    case "365d": return 365;
  }
}

function csvEscape(value: string) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toggleFocusedKeyword(keywordId: string, setFocusedKeywordIds: React.Dispatch<React.SetStateAction<string[]>>) {
  setFocusedKeywordIds((current) => (current.includes(keywordId) ? current.filter((id) => id !== keywordId) : [...current, keywordId]));
}

function clearFocusedKeyword(keywordId: string, setFocusedKeywordIds: React.Dispatch<React.SetStateAction<string[]>>) {
  setFocusedKeywordIds((current) => current.filter((id) => id !== keywordId));
}

function formatChartLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}