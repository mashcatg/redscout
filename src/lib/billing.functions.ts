import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Grace window after a 30-day plan's paid period ends, before data is purged.
const SUBSCRIPTION_GRACE_DAYS = 30;

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    // Find the most recent active subscription for the user
    const { data: subs } = await supabase
      .from("billing_subscriptions")
      .select("id,dodo_subscription_id,status")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1);

    const sub = Array.isArray(subs) && subs.length ? subs[0] : null;
    if (!sub) return { ok: false, error: "No active subscription found" };

    const dodoId = String(sub.dodo_subscription_id ?? "").trim();
    const apiKey = process.env.DODO_API_KEY;
    const base = (process.env.DODO_API_BASE_URL || "https://live.dodopayments.com").replace(/\/+$/g, "");
    let providerResponse: any = null;

    let providerOk = false;
    if (apiKey && dodoId) {
      try {
        // Dodo's documented shape: PATCH /subscriptions/{id} with cancel_at_next_billing_date: true
        const resp = await fetch(`${base}/subscriptions/${encodeURIComponent(dodoId)}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ cancel_at_next_billing_date: true }),
        });
        const body = await resp.text();
        providerResponse = { status: resp.status, ok: resp.ok, body };
        providerOk = resp.ok;
        if (!resp.ok) {
          // Fallback to /v1 path in case the base lacks versioning.
          const resp2 = await fetch(`${base}/v1/subscriptions/${encodeURIComponent(dodoId)}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
            body: JSON.stringify({ cancel_at_next_billing_date: true }),
          });
          const body2 = await resp2.text();
          providerResponse = { status: resp2.status, ok: resp2.ok, body: body2 };
          providerOk = resp2.ok;
        }
      } catch (e) {
        providerResponse = { error: e instanceof Error ? e.message : String(e) };
      }
    }
    if (!providerOk) {
      const errMsg =
        (providerResponse && (providerResponse.body || providerResponse.error)) ||
        "Cancel failed at payment provider";
      return { ok: false, error: String(errMsg).slice(0, 500), providerResponse };
    }

    // Mark subscription cancelled locally (keep access_until as is so the user finishes their paid period).
    try {
      await supabase.from("billing_subscriptions").update({ status: "cancelled" }).eq("id", sub.id);
    } catch {
      // ignore
    }

    // Read user's current access_until to compute the data-purge date.
    const { data: me } = await supabase
      .from("users")
      .select("access_until")
      .eq("id", userId)
      .single();
    const accessUntilStr = (me as { access_until?: string | null } | null)?.access_until ?? null;
    // If no access_until on file (legacy subscription), assume one full period from now.
    const accessUntilMs = accessUntilStr
      ? new Date(accessUntilStr).getTime()
      : Date.now() + SUBSCRIPTION_GRACE_DAYS * 24 * 3600 * 1000;
    const deleteAt = new Date(accessUntilMs + SUBSCRIPTION_GRACE_DAYS * 24 * 3600 * 1000).toISOString();
    const accessUntilOut = accessUntilStr ?? new Date(accessUntilMs).toISOString();

    try {
      await supabase
        .from("users")
        .update({
          subscription_status: "cancelled",
          access_until: accessUntilOut,
          delete_at: deleteAt,
        })
        .eq("id", userId);
    } catch {
      // ignore
    }

    return { ok: true, accessUntil: accessUntilOut, deleteAt, providerResponse };
  });
