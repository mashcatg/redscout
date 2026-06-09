import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuthShell, GoogleButton, inputBase, labelBase, primaryButton } from "@/components/auth/AuthShell";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.redirect ?? "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Signed in");
    navigate({ to: search.redirect ?? "/dashboard" });
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) toast.error(error.message);
  }

  return (
    <AuthShell eyebrow="Welcome back" title="Sign in to redScout" subtitle="Pick up where your Reddit growth left off.">
      <GoogleButton onClick={handleGoogle} />

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> or sign in with email <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelBase}>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputBase} placeholder="you@company.com" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelBase + " mb-0"}>Password</label>
            <Link to="/forgot-password" className="text-[11px] text-muted-foreground hover:text-foreground underline">Forgot?</Link>
          </div>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputBase} placeholder="••••••••" />
        </div>
        <button type="submit" disabled={loading} className={primaryButton}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground text-center">
        No account? <Link to="/signup" className="text-foreground font-semibold underline">Sign up</Link>
      </p>
    </AuthShell>
  );
}
