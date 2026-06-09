import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getIsAdmin } from "@/lib/roles.functions";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { orgId } = Route.useParams();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const adminFn = useServerFn(getIsAdmin);
  const q = useQuery({ queryKey: ["is-admin"], queryFn: () => adminFn() });

  useEffect(() => {
    if (q.data && !q.data.isAdmin) navigate({ to: "/dashboard/$orgId/inbox/seo", params: { orgId } });
  }, [q.data, navigate, orgId]);

  if (q.isLoading) {
    return <div className="flex items-center justify-center p-10"><Spinner size={20} /></div>;
  }
  if (!q.data?.isAdmin) return null;

  const tabs: Array<{ to: "/dashboard/$orgId/admin" | "/dashboard/$orgId/admin/users" | "/dashboard/$orgId/admin/prompts" | "/dashboard/$orgId/admin/warmup"; label: string; exact?: boolean }> = [
    { to: "/dashboard/$orgId/admin", label: "Dashboard", exact: true },
    { to: "/dashboard/$orgId/admin/users", label: "Users" },
    { to: "/dashboard/$orgId/admin/prompts", label: "Prompts" },
    { to: "/dashboard/$orgId/admin/warmup", label: "Warmup" },
  ];

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="text-sm text-muted-foreground mb-4">Internal controls — admins only.</p>
      <div className="flex items-center gap-1 border-b border-border mb-6">
        {tabs.map((t) => {
          const active = t.exact ? pathname.endsWith("/admin") : pathname.includes(t.to.split("$orgId")[1]);
          return (
            <Link
              key={t.to}
              to={t.to}
              params={{ orgId }}
              className={`px-3 py-2 text-sm relative ${active ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
              {active && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-primary rounded-full" />}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
