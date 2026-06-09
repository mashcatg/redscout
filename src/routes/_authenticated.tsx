import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const [status, setStatus] = useState<"checking" | "authed" | "anon">("checking");
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setStatus(data.session ? "authed" : "anon");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setStatus(session ? "authed" : "anon");
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (status === "anon") {
      navigate({ to: "/login", search: { redirect: href } as never, replace: true });
    }
  }, [status, navigate, href]);

  if (status !== "authed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size={28} className="text-primary" />
      </div>
    );
  }
  return <Outlet />;
}
