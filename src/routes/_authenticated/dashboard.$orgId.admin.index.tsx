import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Users, Building2, Tag, Swords, Inbox } from "lucide-react";
import { getAdminStats, listAllOrganizations, listAllUsers, listApiCallLogs } from "@/lib/admin.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import AutoScrollText from "@/components/AutoScrollText";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const fn = useServerFn(getAdminStats);
  const usersFn = useServerFn(listAllUsers);
  const orgsFn = useServerFn(listAllOrganizations);
  const logsFn = useServerFn(listApiCallLogs);
  const q = useQuery({ queryKey: ["admin-stats"], queryFn: () => fn(), refetchInterval: 30000 });
  const usersQ = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn() });
  const orgsQ = useQuery({ queryKey: ["admin-orgs"], queryFn: () => orgsFn() });

  const [userId, setUserId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [apiPlatform, setApiPlatform] = useState("");
  const [feature, setFeature] = useState("");
  const [operation, setOperation] = useState("");
  const [model, setModel] = useState("");
  const [status, setStatus] = useState("");
  const [qText, setQText] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const logFilters = useMemo(() => ({
    userId: userId || undefined,
    orgId: orgId || undefined,
    apiPlatform: apiPlatform || undefined,
    feature: feature.trim() || undefined,
    operation: operation.trim() || undefined,
    model: model.trim() || undefined,
    status: status || undefined,
    q: qText.trim() || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1).toISOString() : undefined,
    limit: 250,
  }), [userId, orgId, apiPlatform, feature, operation, model, status, qText, from, to]);

  function resetFilters() {
    setUserId("");
    setOrgId("");
    setApiPlatform("");
    setFeature("");
    setOperation("");
    setModel("");
    setStatus("");
    setQText("");
    setFrom("");
    setTo("");
  }

  const logsQ = useQuery({
    queryKey: ["admin-api-calls", logFilters],
    queryFn: () => logsFn({ data: logFilters }),
    refetchInterval: 30000,
  });

  useEffect(() => {
    resetFilters();
    // Keep the ledger broad on first load so browser-restored form values don't hide rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (q.isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  const d = q.data;
  if (!d) return null;

  const logs = logsQ.data ?? [];
  const users = usersQ.data ?? [];
  const orgs = orgsQ.data ?? [];
  const userById = new Map(users.map((u: { id: string; email: string; name: string | null }) => [u.id, u]));
  const orgById = new Map(orgs.map((o: { id: string; name: string }) => [o.id, o]));

  const total = logs.length;
  const okCount = logs.filter((row: { ok: boolean }) => row.ok).length;
  const errored = total - okCount;
  const avgLatency = total > 0
    ? Math.round(logs.reduce((sum: number, row: { latency_ms: number | null }) => sum + (row.latency_ms ?? 0), 0) / total)
    : 0;
  const cost = logs.reduce((sum: number, row: { cost_usd: number | null }) => sum + (row.cost_usd ?? 0), 0);
  const logStats = {
    total,
    okCount,
    errored,
    successRate: total > 0 ? Math.round((okCount / total) * 100) : 0,
    avgLatency,
    cost,
  };

  const cards = [
    { label: "Users", value: d.users, icon: Users },
    { label: "Organizations", value: d.orgs, icon: Building2 },
    { label: "Keywords", value: d.keywords, icon: Tag },
    { label: "Competitors", value: d.competitors, icon: Swords },
    { label: "Inbox items", value: d.inbox, icon: Inbox },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="border border-border rounded p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-bold">{c.value.toLocaleString()}</div>
            </div>
          );
        })}
      </div>

      <div className="border border-border rounded p-4">
        <h2 className="font-semibold mb-3">Scan jobs by status</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(d.jobs).map(([s, n]) => (
            <span key={s} className="px-2 py-1 rounded bg-muted">
              <span className="font-mono">{s}</span>: <span className="font-semibold">{n}</span>
            </span>
          ))}
          {Object.keys(d.jobs).length === 0 && <span className="text-muted-foreground">No jobs yet.</span>}
        </div>
      </div>

      <div className="border border-border rounded p-4">
        <h2 className="font-semibold mb-3">Inbox items — last 30 days</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.series}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    
      <div className="border border-border rounded p-4 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold">API calls</h2>
            <p className="text-xs text-muted-foreground">Filter by user, organization, platform, feature, model, status, and date range. All metrics below follow the filters.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={resetFilters} className="text-xs px-2 py-1 border border-border rounded hover:bg-muted">
              Reset filters
            </button>
            <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">{logStats.total} rows</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="border border-border rounded p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Calls</div>
            <div className="mt-1 text-xl font-bold">{logStats.total.toLocaleString()}</div>
          </div>
          <div className="border border-border rounded p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Success rate</div>
            <div className="mt-1 text-xl font-bold">{logStats.successRate}%</div>
          </div>
          <div className="border border-border rounded p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg latency</div>
            <div className="mt-1 text-xl font-bold">{logStats.avgLatency}ms</div>
          </div>
          <div className="border border-border rounded p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Cost</div>
            <div className="mt-1 text-xl font-bold">${logStats.cost.toFixed(4)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">User</label>
            <SearchableSelect
              value={userId}
              onValueChange={setUserId}
              placeholder="All users"
              searchPlaceholder="Search users..."
              options={[
                { value: "", label: "All users", keywords: ["any", "everyone"] },
                ...users.map((u: { id: string; email: string; name: string | null }) => ({
                  value: u.id,
                  label: u.name ?? u.email,
                  keywords: [u.email, u.name ?? ""],
                })),
              ]}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Organization</label>
            <SearchableSelect
              value={orgId}
              onValueChange={setOrgId}
              placeholder="All orgs"
              searchPlaceholder="Search organizations..."
              options={[
                { value: "", label: "All orgs", keywords: ["any"] },
                ...orgs.map((o: { id: string; name: string }) => ({ value: o.id, label: o.name, keywords: [o.id] })),
              ]}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Platform</label>
            <SearchableSelect
              value={apiPlatform}
              onValueChange={setApiPlatform}
              placeholder="All platforms"
              searchPlaceholder="Search platforms..."
              options={[
                { value: "", label: "All platforms", keywords: ["any"] },
                { value: "brightdata", label: "BrightData" },
                { value: "sociavault", label: "Sociavault" },
                { value: "deepseek", label: "DeepSeek" },
                { value: "claude", label: "Claude" },
                { value: "firecrawl", label: "Firecrawl" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</label>
            <SearchableSelect
              value={status}
              onValueChange={setStatus}
              placeholder="Any status"
              searchPlaceholder="Search status..."
              options={[
                { value: "", label: "Any status", keywords: ["all"] },
                { value: "ok", label: "OK" },
                { value: "error", label: "Error" },
              ]}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Feature</label>
            <Input autoComplete="off" value={feature} onChange={(e) => setFeature(e.target.value)} placeholder="scan, warmup, comment..." className="mt-1 h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Operation</label>
            <Input autoComplete="off" value={operation} onChange={(e) => setOperation(e.target.value)} placeholder="reddit_search, generate_comment..." className="mt-1 h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Model</label>
            <Input autoComplete="off" value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat, claude-sonnet..." className="mt-1 h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Search</label>
            <Input autoComplete="off" value={qText} onChange={(e) => setQText(e.target.value)} placeholder="endpoint, error, feature..." className="mt-1 h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">From</label>
            <Input autoComplete="off" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">To</label>
            <Input autoComplete="off" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9" />
          </div>
        </div>

        {logsQ.error && (
          <div className="border border-destructive/40 bg-destructive/5 rounded p-3 text-xs text-destructive">
            {(logsQ.error as Error).message}
          </div>
        )}

        <div className="overflow-auto border border-border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Org</th>
                <th className="px-3 py-2">Platform</th>
                <th className="px-3 py-2">Feature</th>
                <th className="px-3 py-2">Operation</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Latency</th>
                <th className="px-3 py-2">Cost</th>
                <th className="px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-xs text-muted-foreground">No API calls match the current filters.</td>
                </tr>
              ) : logs.map((row: {
                id: string;
                created_at: string;
                user_id: string;
                org_id: string | null;
                api_platform: string;
                feature: string;
                operation: string;
                model: string | null;
                ok: boolean;
                latency_ms: number | null;
                cost_usd: number | null;
                error_message: string | null;
              }) => {
                const user = userById.get(row.user_id);
                const org = row.org_id ? orgById.get(row.org_id) : null;
                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{user?.name ?? user?.email ?? row.user_id.slice(0, 8)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{org?.name ?? (row.org_id ? row.org_id.slice(0, 8) : "-")}</td>
                    <td className="px-3 py-2 whitespace-nowrap capitalize">{row.api_platform}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.feature}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.operation}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.model ?? "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase " + (row.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
                        {row.ok ? "OK" : "Error"}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.latency_ms ?? "-"}ms</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.cost_usd != null ? '$' + row.cost_usd.toFixed(4) : "-"}</td>
                    <td className="px-3 py-2 text-xs text-destructive max-w-[18rem]" title={row.error_message ?? ""}>
                      <AutoScrollText text={row.error_message ?? "-"} className="truncate" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
