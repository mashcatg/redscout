import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuthShell, inputBase, labelBase, primaryButton } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success("Reset link sent");
  }

  return (
    <AuthShell eyebrow="Forgot password" title="Reset your password" subtitle="We'll email you a secure reset link.">
      {sent ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          Check <strong>{email}</strong> for a reset link. It expires in 1 hour.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelBase}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputBase} placeholder="you@company.com" />
          </div>
          <button type="submit" disabled={loading} className={primaryButton}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted-foreground text-center">
        <Link to="/login" className="text-foreground font-semibold underline">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
