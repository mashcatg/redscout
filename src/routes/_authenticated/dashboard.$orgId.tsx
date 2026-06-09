import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Inbox, MessageSquare, Swords, Settings, LogOut,
  ChevronUp, Sparkles, Send, Shield, Zap, Check, Plus, ChevronsUpDown, BarChart3, LayoutDashboard, Lock,
} from "lucide-react";
import BrandIcon from "@/components/BrandIcon";
import { ExpiryBanner } from "@/components/ExpiryBanner";

import { getOrganization, listOrganizations, getCurrentUser, getPlanUsage } from "@/lib/org.functions";
import { getIsAdmin } from "@/lib/roles.functions";
import { listInboxItems } from "@/lib/scan.functions";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export const Route = createFileRoute("/_authenticated/dashboard/$orgId")({
  component: DashboardLayout,
});

const SIDEBAR_KEY = "sidebar_width";
const MIN_W = 200;
const MAX_W = 480;

function DashboardLayout() {
  const { orgId } = Route.useParams();
  const navigate = useNavigate();
  const getOrg = useServerFn(getOrganization);
  const listOrgs = useServerFn(listOrganizations);
  const getMe = useServerFn(getCurrentUser);
  const planFn = useServerFn(getPlanUsage);
  const adminFn = useServerFn(getIsAdmin);
  const inboxItemsFn = useServerFn(listInboxItems);

  const orgQ = useQuery({ queryKey: ["org", orgId], queryFn: () => getOrg({ data: { orgId } }) });
  const orgsQ = useQuery({ queryKey: ["orgs"], queryFn: () => listOrgs() });
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const planQ = useQuery({ queryKey: ["plan-usage"], queryFn: () => planFn(), refetchInterval: 30000 });
  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => adminFn() });
  const inboxCountsQ = useQuery({
    queryKey: ["sidebar-inbox-counts", orgId],
    queryFn: async () => {
      const [reddit, seo, competitors] = await Promise.all([
        inboxItemsFn({ data: { orgId, source: "sociavault_keyword" } }),
        inboxItemsFn({ data: { orgId, source: "brightdata_serp" } }),
        inboxItemsFn({ data: { orgId, source: "sociavault_competitor" } }),
      ]);
      return {
        reddit: reddit.length,
        seo: seo.length,
        competitors: competitors.length,
      };
    },
    refetchInterval: 15000,
  });

  // Resizable sidebar
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 256;
    const saved = Number(localStorage.getItem(SIDEBAR_KEY));
    return saved >= MIN_W && saved <= MAX_W ? saved : 256;
  });
  const draggingRef = useRef(false);
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const w = Math.min(MAX_W, Math.max(MIN_W, e.clientX));
      setWidth(w);
    }
    function onUp() {
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem(SIDEBAR_KEY, String(width));
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [width]);

  const inboxNav = [
    { to: "/dashboard/$orgId/inbox/reddit", label: "Reddit", icon: MessageSquare },
    { to: "/dashboard/$orgId/inbox/seo", label: "SEO", icon: Inbox },
    { to: "/dashboard/$orgId/competitors", label: "Competitors", icon: Swords },
  ] as const;

  const insightsNav = [
    { to: "/dashboard/$orgId/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/dashboard/$orgId/dm", label: "DM", icon: Send },
  ] as const;

  const plan = planQ.data;
  const counts = inboxCountsQ.data ?? { reddit: 0, seo: 0, competitors: 0 };
  const inboxTotal = counts.reddit + counts.seo + counts.competitors;
  const initials = (meQ.data?.name ?? meQ.data?.email ?? "?").slice(0, 2).toUpperCase();
  const orgs = orgsQ.data ?? [];
  const currentOrg = orgs.find((o) => o.id === orgId) ?? { id: orgId, name: orgQ.data?.name ?? "Workspace" };
  const orgInitial = (currentOrg.name ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <aside
        style={{ width }}
        className="shrink-0 border-r border-border flex flex-col bg-card h-screen relative"
      >
        {/* Brand */}
        <div className="p-4 border-b border-border shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <BrandIcon className="h-10 w-auto" />
          </Link>
        </div>

        {/* Org switcher dropdown */}
        <div className="p-3 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-background hover:bg-accent/40 transition text-left">
                <div className="h-6 w-6 rounded bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                  {orgInitial}
                </div>
                <span className="flex-1 truncate text-sm font-medium">{currentOrg.name}</span>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
              {orgs.map((o) => (
                <DropdownMenuItem
                  key={o.id}
                  onClick={() => navigate({ to: "/dashboard/$orgId/overview", params: { orgId: o.id } })}
                  className="gap-2"
                >
                  <div className="h-5 w-5 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                    {(o.name ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.id === orgId && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate({ to: "/onboarding", search: { add: 1 } })}
                className="gap-2 text-primary"
              >
                <Plus className="h-4 w-4" /> Add organization
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Nav */}
        <nav className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
          <div>
            <Link
              to="/dashboard/$orgId/overview"
              params={{ orgId }}
              activeProps={{ className: "bg-accent text-accent-foreground" }}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-accent/60 transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </div>

          <div>
            <div className="px-3 pb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              <span>Inbox</span>
              <NavBadge value={inboxTotal} />
            </div>
            <div className="space-y-0.5">
              {inboxNav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  params={{ orgId }}
                  activeProps={{ className: "bg-accent text-accent-foreground" }}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-accent/60 transition-colors"
                >
                  <n.icon className="h-4 w-4" />
                  <span className="flex-1">{n.label}</span>
                  {n.to === "/dashboard/$orgId/inbox/reddit" && <NavBadge value={counts.reddit} />}
                  {n.to === "/dashboard/$orgId/inbox/seo" && <NavBadge value={counts.seo} />}
                  {n.to === "/dashboard/$orgId/competitors" && <NavBadge value={counts.competitors} />}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <Link
              to="/dashboard/$orgId/warmup"
              params={{ orgId }}
              activeProps={{ className: "bg-accent text-accent-foreground" }}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-accent/60 transition-colors"
            >
              <Zap className="h-4 w-4" />
              Warmup
            </Link>
          </div>

          <div>
            <div className="px-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Insights</div>
            <div className="space-y-0.5">
              {insightsNav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  params={{ orgId }}
                  activeProps={{ className: "bg-accent text-accent-foreground" }}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-accent/60 transition-colors"
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <Link
              to="/dashboard/$orgId/settings"
              params={{ orgId }}
              activeProps={{ className: "bg-accent text-accent-foreground" }}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-accent/60 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>

          {adminQ.data?.isAdmin && (
            <Link
              to="/dashboard/$orgId/admin"
              params={{ orgId }}
              activeProps={{ className: "bg-accent text-accent-foreground" }}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-accent/60 transition-colors text-primary"
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}
        </nav>

        {/* Plan usage */}
        <div className="p-3 border-t border-border space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              {plan?.plan ?? "—"} plan
            </span>
          </div>
          {planQ.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : (
            <>
              <UsageBar label="Organizations" used={plan?.orgs.used ?? 0} max={plan?.orgs.max ?? 0} />
              <UsageBar label="Keywords" used={plan?.keywords.used ?? 0} max={plan?.keywords.max ?? 0} />
              <UsageBar label="Competitors" used={plan?.competitors.used ?? 0} max={plan?.competitors.max ?? 0} />
            </>
          )}
          <Button
            size="sm"
            className="w-full h-8 text-xs gap-1"
            onClick={() => navigate({ to: "/dashboard/$orgId/billing", params: { orgId } })}
          >
            <Sparkles className="h-3 w-3" /> {plan?.nextPlan ? `Upgrade to ${plan.nextPlan}` : "Upgrade plan"}
          </Button>
        </div>

        {/* Profile dropdown */}
        <div className="p-3 border-t border-border shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 p-2 rounded hover:bg-accent/60 text-left">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={meQ.data?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{meQ.data?.name ?? meQ.data?.email ?? "…"}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{meQ.data?.email}</div>
                </div>
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem onClick={() => navigate({ to: "/dashboard/$orgId/settings", params: { orgId }, search: { tab: "profile" } })}>
                <Settings className="h-4 w-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
              >
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            draggingRef.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary transition-colors"
          style={{ cursor: "col-resize" }}
        />
      </aside>

      <main className="flex-1 min-w-0 overflow-auto flex flex-col">
        <ExpiryBanner orgId={orgId} plan={plan} />
        <div className="flex-1 min-h-0">
          <AccessGate orgId={orgId} plan={plan}>
            <Outlet />
          </AccessGate>
        </div>
      </main>


    </div>
  );
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{used}/{max}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

function NavBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-semibold tabular-nums">
      {value}
    </span>
  );
}

// Allowed paths while access is expired. Overview keeps widgets/streak visible;
// billing + settings let the user reactivate. Everything else is gated.
const ALLOWED_WHEN_EXPIRED = [
  "/dashboard/$orgId/overview",
  "/dashboard/$orgId/billing",
  "/dashboard/$orgId/settings",
];

function AccessGate({
  orgId,
  plan,
  children,
}: {
  orgId: string;
  plan: { isActive?: boolean; accessUntil?: string | null; passType?: string | null } | undefined;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const matches = useRouterState({ select: (s) => s.matches });
  const currentRouteId = matches[matches.length - 1]?.routeId ?? "";
  // Resolve the dashboard child route id (strip the orgId layout prefix).
  const allowed = ALLOWED_WHEN_EXPIRED.some((p) => currentRouteId.endsWith(p.replace("$orgId", "$orgId")));

  // While we don't know yet, render children.
  if (!plan) return <>{children}</>;
  if (plan.isActive) return <>{children}</>;
  if (allowed) return <>{children}</>;

  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold">Access expired</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {plan.accessUntil
            ? `Your ${plan.passType === "pass3day" ? "3-day pass" : "subscription"} ended on ${new Date(plan.accessUntil).toLocaleDateString()}.`
            : "Your subscription is no longer active."}
          {" "}Your dashboard widgets, daily targets, and streak stay available. Renew to unlock the rest.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => navigate({ to: "/dashboard/$orgId/billing", params: { orgId } })}>
            Renew access
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/dashboard/$orgId/overview", params: { orgId } })}>
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

