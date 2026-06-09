import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { BILLING_PLANS, parseBillingPlan } from "@/lib/billing.config";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ConfirmBody = {
  payment_id?: string | null;
  subscription_id?: string | null;
  status?: string | null;
  email?: string | null;
  plan?: string | null;
  amount?: number | null;
  currency?: string | null;
  invoice_id?: string | null;
};

function projectLimitToInt(value: number | "unlimited") {
  return value === "unlimited" ? 999999 : value;
}

export const Route = createFileRoute("/api/payment/confirm")({
  server: {
    handlers: {
      POST: async (event: any) => {
        try {
          const request = event?.request as Request;
          if (!request) {
            return new Response(JSON.stringify({ ok: false, error: "Missing request" }), { status: 400 });
          }

          const body = (await request.json()) as ConfirmBody;
          const email = String(body?.email ?? "").trim().toLowerCase();
          const paymentId = String(body?.payment_id ?? "").trim();
          const subscriptionId = String(body?.subscription_id ?? "").trim();
          const status = String(body?.status ?? "pending").trim() || "pending";

          if (!email) {
            return new Response(JSON.stringify({ ok: false, error: "Email is required" }), { status: 400 });
          }

          const plan = parseBillingPlan(body?.plan ?? "starter");
          const planDef = BILLING_PLANS[plan];

          const db = supabaseAdmin as any;
          const { data: userRow } = await db
            .from("users")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          const userId: string | null = userRow?.id ?? null;

          const { data: customer, error: customerErr } = await db
            .from("billing_customers")
            .upsert(
              {
                email,
                name: null,
                user_id: userId,
                dodo_customer_id: null,
              },
              { onConflict: "email" },
            )
            .select("id")
            .single();
          if (customerErr) throw customerErr;

          const customerId = customer.id as string;

          let billingSubscriptionId: string | null = null;
          if (subscriptionId) {
            const { data: sub, error: subErr } = await db
              .from("billing_subscriptions")
              .upsert(
                {
                  dodo_subscription_id: subscriptionId,
                  customer_id: customerId,
                  user_id: userId,
                  plan,
                  status,
                  keywords_limit: planDef.limits.keywords,
                  competitors_limit: planDef.limits.competitors,
                  projects_limit: projectLimitToInt(planDef.limits.projects),
                  raw_payload: body,
                },
                { onConflict: "dodo_subscription_id" },
              )
              .select("id")
              .single();
            if (subErr) throw subErr;
            billingSubscriptionId = sub.id as string;
          }

          if (paymentId) {
            const { error: paymentErr } = await db
              .from("billing_payments")
              .upsert(
                {
                  dodo_payment_id: paymentId,
                  subscription_id: billingSubscriptionId,
                  customer_id: customerId,
                  user_id: userId,
                  invoice_id: body.invoice_id ?? null,
                  amount_cents: typeof body.amount === "number" ? Math.round(body.amount) : null,
                  currency: (body.currency ?? "USD").toUpperCase(),
                  status,
                  raw_payload: body,
                },
                { onConflict: "dodo_payment_id" },
              );
            if (paymentErr) throw paymentErr;
          }

          if (userId && (status === "succeeded" || status === "active" || status === "paid")) {
            const { error: userErr } = await db.from("users").update({ plan }).eq("id", userId);
            if (userErr) throw userErr;
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
