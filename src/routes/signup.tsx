import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuthShell, GoogleButton, inputBase, labelBase, primaryButton } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/onboarding" : undefined,
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data.session) {
      toast.success("Account created");
      navigate({ to: "/onboarding" });
    } else {
      toast.success("Check your email to confirm");
    }
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/onboarding" },
    });
    if (error) toast.error(error.message);
  }

  return (
    <AuthShell eyebrow="Get started" title="Start scouting Reddit in minutes" subtitle="No credit card. 3-Day Pass available for $5.">
      <GoogleButton onClick={handleGoogle} label="Sign up with Google" />

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> or with email <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelBase}>Your name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputBase} placeholder="Jane Doe" />
        </div>
        <div>
          <label className={labelBase}>Work email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputBase} placeholder="you@company.com" />
        </div>
        <div>
          <label className={labelBase}>Password</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputBase} placeholder="At least 6 characters" />
        </div>
        <button type="submit" disabled={loading} className={primaryButton}>
          {loading ? "Creating…" : "Create my account"}
        </button>
        <p className="text-[11px] text-muted-foreground text-center">By signing up you agree to our Terms & Privacy.</p>
      </form>
      <p className="mt-6 text-sm text-muted-foreground text-center">
        Have an account? <Link to="/login" className="text-foreground font-semibold underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
