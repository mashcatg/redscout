import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { BILLING_PLANS, parseBillingPlan } from "@/lib/billing.config";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function projectLimitToInt(value: number | "unlimited") {
  return value === "unlimited" ? 999999 : value;
}

function verifySignature(rawBody: string, signature: string | null, secret: string | undefined) {
  if (!secret) return true;
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = signature.trim();
  if (expected.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

export const Route = createFileRoute("/api/webhooks/dodo")({
  server: {
    handlers: {
      POST: async (event: any) => {
        try {
          const request = event?.request as Request;
          if (!request) return new Response("Missing request", { status: 400 });

          const raw = await request.text();
          const signature = request.headers.get("x-dodo-signature");
          if (!verifySignature(raw, signature, process.env.DODO_WEBHOOK_SECRET)) {
            return new Response("Invalid signature", { status: 401 });
          }

          const body = JSON.parse(raw || "{}");
          const eventType = String(body?.type ?? body?.event ?? "");

          const payload = body?.data ?? body;
          const email = String(
            payload?.customer?.email ??
              payload?.email ??
              payload?.metadata?.email ??
              "",
          ).trim().toLowerCase();
          const paymentId = String(payload?.payment_id ?? payload?.id ?? "").trim();
          const dodoSubscriptionId = String(payload?.subscription_id ?? payload?.subscription?.id ?? "").trim();
          const status = String(payload?.status ?? "pending").trim() || "pending";
          const invoiceId = payload?.invoice_id ?? payload?.invoice?.id ?? null;
          const amountCents = typeof payload?.amount === "number"
            ? Math.round(payload.amount)
            : typeof payload?.amount_cents === "number"
              ? Math.round(payload.amount_cents)
              : null;
          const currency = String(payload?.currency ?? "USD").toUpperCase();

          const metaPlan = String(payload?.metadata?.plan ?? payload?.plan ?? "starter").toLowerCase();
          const isPass3Day = metaPlan === "pass3day";
          let plan: "starter" | "growth" | "agency" = "starter";
          if (!isPass3Day) {
            try {
              plan = parseBillingPlan(metaPlan);
            } catch {
              plan = "starter";
            }
          }
          const planDef = BILLING_PLANS[plan];

          const db = supabaseAdmin as any;
          let customerId: string | null = null;
          let userId: string | null = null;

          if (email) {
            const { data: userRow } = await db.from("users").select("id").eq("email", email).maybeSingle();
            userId = userRow?.id ?? null;

            const { data: customer, error: customerErr } = await db
              .from("billing_customers")
              .upsert(
                {
                  email,
                  name: payload?.customer?.name ?? null,
                  user_id: userId,
                  dodo_customer_id: payload?.customer?.id ?? null,
                },
                { onConflict: "email" },
              )
              .select("id")
              .single();
            if (customerErr) throw customerErr;
            customerId = customer.id as string;
          }

          let billingSubscriptionId: string | null = null;
          if (!isPass3Day && dodoSubscriptionId && customerId) {
            const { data: sub, error: subErr } = await db
              .from("billing_subscriptions")
              .upsert(
                {
                  dodo_subscription_id: dodoSubscriptionId,
                  customer_id: customerId,
                  user_id: userId,
                  plan,
                  status,
                  keywords_limit: planDef.limits.keywords,
                  competitors_limit: planDef.limits.competitors,
                  projects_limit: projectLimitToInt(planDef.limits.projects),
                  raw_payload: payload,
                },
                { onConflict: "dodo_subscription_id" },
              )
              .select("id")
              .single();
            if (subErr) throw subErr;
            billingSubscriptionId = sub.id as string;
          }

          if ((eventType === "payment.succeeded" || eventType === "invoice.paid") && paymentId && customerId) {
            const { error: payErr } = await db.from("billing_payments").upsert(
              {
                dodo_payment_id: paymentId,
                subscription_id: billingSubscriptionId,
                customer_id: customerId,
                user_id: userId,
                invoice_id: invoiceId,
                amount_cents: amountCents,
                currency,
                status,
                raw_payload: payload,
              },
              { onConflict: "dodo_payment_id" },
            );
            if (payErr) throw payErr;
          }

          const paid = eventType === "subscription.active" || eventType === "subscription.renewed" || eventType === "payment.succeeded" || eventType === "invoice.paid";
          const cancelled = eventType === "subscription.cancelled" || eventType === "subscription.canceled" || eventType === "subscription.failed";

          if (paid && userId) {
            if (isPass3Day) {
              const accessUntil = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
              // 3-day pass: 3 days of access + 3 more days grace before deletion.
              const deleteAt = new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString();
              const { error: userErr } = await db
                .from("users")
                .update({
                  plan: "starter",
                  pass_type: "pass3day",
                  subscription_status: "active",
                  access_until: accessUntil,
                  delete_at: deleteAt,
                })
                .eq("id", userId);
              if (userErr) throw userErr;
            } else {
              // Subscription: extend access_until by one billing period (30 days)
              // unless Dodo gave us a concrete current_period_end.
              const cpe = payload?.current_period_end ?? payload?.subscription?.current_period_end ?? null;
              const accessUntil = cpe
                ? new Date(cpe).toISOString()
                : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
              const { error: userErr } = await db
                .from("users")
                .update({
                  plan,
                  subscription_status: "active",
                  pass_type: null,
                  access_until: accessUntil,
                  delete_at: null,
                })
                .eq("id", userId);
              if (userErr) throw userErr;
            }
          } else if (cancelled && userId) {
            // Provider-side cancellation — preserve access_until, set delete_at.
            const { data: u } = await db
              .from("users")
              .select("access_until")
              .eq("id", userId)
              .single();
            const accessUntilStr = (u as { access_until?: string | null } | null)?.access_until ?? null;
            const accessUntilMs = accessUntilStr
              ? new Date(accessUntilStr).getTime()
              : Date.now();
            const deleteAt = new Date(accessUntilMs + 30 * 24 * 3600 * 1000).toISOString();
            await db
              .from("users")
              .update({
                subscription_status: "cancelled",
                delete_at: deleteAt,
              })
              .eq("id", userId);
          }



          return Response.json({ ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
