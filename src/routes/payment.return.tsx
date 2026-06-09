import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/payment/return")({
  component: PaymentReturnPage,
});

function PaymentReturnPage() {
  const search = Route.useSearch() as Record<string, string | undefined>;
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("Confirming your payment...");

  const paymentId = String(search.payment_id ?? "").trim();
  const subscriptionId = String(search.subscription_id ?? "").trim();
  const status = String(search.status ?? "").trim();
  const email = String(search.email ?? "").trim();
  const plan = String(search.plan ?? "").trim();

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        const res = await fetch("/api/payment/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            payment_id: paymentId || null,
            subscription_id: subscriptionId || null,
            status: status || null,
            email: email || null,
            plan: plan || null,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Payment confirmation failed");
        }

        if (!active) return;
        setState("done");
        setMessage("Payment processed. Your subscription is being activated.");
      } catch (e) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : String(e);
        setState("error");
        setMessage(msg || "Something went wrong while confirming your payment.");
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [email, paymentId, plan, status, subscriptionId]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-lg border border-border rounded-xl bg-card p-8 space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Billing confirmation</h1>
        <p className="text-sm text-muted-foreground">{message}</p>

        {state === "done" && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link to="/dashboard" className="text-sm font-semibold underline underline-offset-4">Go to dashboard</Link>
          </div>
        )}

        {state === "error" && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link to="/" className="text-sm font-semibold underline underline-offset-4">Back to home</Link>
          </div>
        )}
      </div>
    </div>
  );
}
