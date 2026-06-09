import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { listOrganizations } from "@/lib/org.functions";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardIndex,
});

function DashboardIndex() {
  const navigate = useNavigate();
  const listFn = useServerFn(listOrganizations);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await listFn();
        const orgs = Array.isArray(res) ? res : res?.organizations;
        if (!orgs || orgs.length === 0) {
          navigate({ to: "/onboarding", replace: true });
        } else {
          navigate({
            to: "/dashboard/$orgId/overview",
            params: { orgId: orgs[0].id },
            replace: true,
          });
        }
      } catch {
        navigate({ to: "/onboarding", replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
