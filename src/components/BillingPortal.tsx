import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser, getPlanUsage } from "@/lib/org.functions";
import { cancelMySubscription } from "@/lib/billing.functions";
import { BILLING_PLANS, THREE_DAY_PASS, type BillingPlan, type CheckoutPlan, getDiscountedPriceLabel, getProjectLimitLabel, getYearlyPriceLabel } from "@/lib/billing.config";


export function BillingPortal() {
  const getMe = useServerFn(getCurrentUser);
  const planFn = useServerFn(getPlanUsage);
  const queryClient = useQueryClient();
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const planQ = useQuery({ queryKey: ["plan-usage"], queryFn: () => planFn() });
  const [loadingPlan, setLoadingPlan] = useState<CheckoutPlan | null>(null);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cancelFn = useServerFn(cancelMySubscription);
  const [canceling, setCanceling] = useState(false);
  const currentPlan = (planQ.data?.plan ?? "starter") as BillingPlan;
  const accessUntil = planQ.data?.accessUntil ?? null;
  const passType = planQ.data?.passType ?? null;
  const subscriptionStatus = planQ.data?.subscriptionStatus ?? "inactive";




  async function checkout(plan: CheckoutPlan) {
    if (!meQ.data?.email) {
      setErrorMessage("Missing user email");
      return;
    }
    setLoadingPlan(plan);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan,
          email: meQ.data.email,
          name: meQ.data.name ?? undefined,
          interval,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.payment_link) throw new Error(data?.error ?? "Checkout failed");
      window.location.href = data.payment_link;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message || "Checkout failed");
      toast.error(message || "Checkout failed");
    } finally {
      setLoadingPlan(null);
    }
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">Current plan, upgrades, and subscription management live here. Early users get 50% off and yearly stacks an extra 20%.</p>
        <div className="mt-4 inline-flex items-center rounded-full border border-border bg-card p-1 text-sm">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={`rounded-full px-4 py-1.5 font-semibold transition ${interval === "monthly" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={`rounded-full px-4 py-1.5 font-semibold transition ${interval === "yearly" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            Yearly <span className="text-primary">-20%</span>
          </button>
        </div>
        {errorMessage && <p className="text-sm text-destructive mt-2">{errorMessage}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-border bg-muted/10 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</p>
              <p className="mt-2 text-2xl font-semibold">{BILLING_PLANS[currentPlan].label}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {interval === "monthly"
                  ? `${getDiscountedPriceLabel(BILLING_PLANS[currentPlan].monthlyPriceCents)}/mo`
                  : `${getYearlyPriceLabel(BILLING_PLANS[currentPlan].monthlyPriceCents)}/yr`}
                · {getProjectLimitLabel(BILLING_PLANS[currentPlan].limits.projects)}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${subscriptionStatus === "cancelled" ? "bg-amber-500/10 text-amber-700" : "bg-primary/10 text-primary"}`}>
              {subscriptionStatus === "cancelled" ? "Cancelled" : "Active"}
            </span>

          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="h-9 rounded-md border border-foreground bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
              disabled={loadingPlan !== null || (currentPlan === "agency" && subscriptionStatus !== "cancelled")}
              onClick={() => {
                const target = subscriptionStatus === "cancelled"
                  ? (currentPlan as BillingPlan)
                  : ((planQ.data?.nextPlan ?? "growth") as BillingPlan);
                void checkout(target);
              }}
            >
              {loadingPlan
                ? "Opening checkout..."
                : subscriptionStatus === "cancelled"
                  ? `Renew ${BILLING_PLANS[currentPlan].label}`
                  : "Upgrade plan"}
            </button>
            {subscriptionStatus !== "cancelled" && (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-semibold transition hover:border-destructive hover:text-destructive"
                disabled={canceling || passType === "pass3day"}
                onClick={async () => {
                  const accessEnd = accessUntil
                    ? new Date(accessUntil).toLocaleDateString()
                    : "the end of your billing period";
                  const deleteEnd = accessUntil
                    ? new Date(new Date(accessUntil).getTime() + 30 * 24 * 3600 * 1000).toLocaleDateString()
                    : "30 days after your access ends";
                  const ok = window.confirm(
                    `Cancel subscription?\n\nYou'll keep full access until ${accessEnd}.\nYour workspace data will be permanently deleted on ${deleteEnd} unless you resubscribe.`,
                  );
                  if (!ok) return;
                  setCanceling(true);
                  setErrorMessage(null);
                  try {
                    const res = await cancelFn();
                    if (!res || !res.ok) {
                      const msg = res?.error ?? "Cancel failed";
                      setErrorMessage(msg);
                      toast.error(msg);
                    } else {
                      toast.success("Subscription cancelled — access continues until your period ends");
                      await queryClient.invalidateQueries({ queryKey: ["plan-usage"] });
                      await queryClient.invalidateQueries({ queryKey: ["me"] });
                    }
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    setErrorMessage(msg);
                    toast.error(msg);
                  } finally {
                    setCanceling(false);
                  }
                }}
              >
                {canceling ? "Canceling..." : "Cancel subscription"}
              </button>
            )}
          </div>
          {accessUntil && (
            <p className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Access active until {new Date(accessUntil).toLocaleString()}
              {passType === "pass3day" ? " (3-Day Pass)" : ""}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Need help? Email hello@redscout.tech.</p>

        </div>

        <div className="rounded-xl border border-dashed border-border p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan summary</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {BILLING_PLANS[currentPlan].limits.keywords} keywords</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {BILLING_PLANS[currentPlan].limits.competitors} competitors</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {getProjectLimitLabel(BILLING_PLANS[currentPlan].limits.projects)} projects</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.values(BILLING_PLANS) as Array<(typeof BILLING_PLANS)[BillingPlan]>).map((plan) => {
          const active = currentPlan === plan.key;
          return (
            <div key={plan.key} className={`border rounded-xl p-5 ${active ? "border-primary bg-primary/5" : "border-border bg-muted/10"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{plan.label}</p>
                  <p className="mt-2 flex items-baseline gap-3">
                    <span className="text-sm line-through text-muted-foreground">{plan.monthlyPriceLabel}</span>
                    <span className="text-3xl font-bold">
                      {interval === "monthly"
                        ? getDiscountedPriceLabel(plan.monthlyPriceCents)
                        : getYearlyPriceLabel(plan.monthlyPriceCents)}
                      <span className="text-sm font-medium text-muted-foreground">{interval === "monthly" ? "/mo" : "/yr"}</span>
                    </span>
                  </p>
                </div>
                {active && <span className="text-xs font-semibold text-primary">Current</span>}
              </div>
              <p className="mt-2 text-xs font-semibold text-primary">
                {interval === "monthly" ? "50% off for Early Users" : "Yearly = 50% early-bird + extra 20%"}
              </p>

              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {plan.limits.keywords} keywords</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {plan.limits.competitors} competitors</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {getProjectLimitLabel(plan.limits.projects)} projects</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> AI post scoring + relevance filters</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Competitor mention tracking</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Warmup + daily streak analytics</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Cancel anytime</li>
              </ul>

              <button
                type="button"
                disabled={loadingPlan !== null || (active && subscriptionStatus !== "cancelled")}
                onClick={() => { void checkout(plan.key); }}
                className="mt-5 w-full h-9 rounded-md border border-foreground bg-foreground text-background text-sm font-semibold disabled:opacity-50"
              >
                {active && subscriptionStatus === "cancelled"
                  ? `Renew ${plan.label}`
                  : active
                    ? "Current plan"
                    : loadingPlan === plan.key
                      ? "Opening checkout..."
                      : `Choose ${plan.label}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-amber-300/70 bg-amber-50/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">One-time pass</p>
            <h3 className="mt-1 text-xl font-semibold">{THREE_DAY_PASS.label} — {THREE_DAY_PASS.priceLabel}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{THREE_DAY_PASS.description}</p>
            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              {THREE_DAY_PASS.features.map((f) => (
                <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-600" />{f}</li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            disabled={loadingPlan !== null}
            onClick={() => { void checkout("pass3day"); }}
            className="h-10 rounded-md bg-amber-500 px-5 text-sm font-semibold text-white shadow hover:bg-amber-600 disabled:opacity-50"
          >
            {loadingPlan === "pass3day" ? "Opening checkout..." : `Get ${THREE_DAY_PASS.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
