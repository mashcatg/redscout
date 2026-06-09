import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { BILLING_PLANS, getPlanProductId, getPass3DayProductId, parseCheckoutPlan } from "@/lib/billing.config";

type CheckoutBody = {
  plan: string;
  email: string;
  name?: string;
};

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      POST: async (event: any) => {
        try {
          const request = event?.request as Request;
          if (!request) return badRequest("Missing request");

          const body = (await request.json()) as CheckoutBody;
          const plan = parseCheckoutPlan(body?.plan);
          const email = (body?.email ?? "").trim().toLowerCase();
          const name = (body?.name ?? "").trim();

          if (!email) return badRequest("Email is required");
          if (!/^\S+@\S+\.\S+$/.test(email)) return badRequest("Invalid email");

          const apiKey = process.env.DODO_API_KEY;
          if (!apiKey) throw new Error("Missing DODO_API_KEY");

          const configuredApiBase = process.env.DODO_API_BASE_URL?.trim() || "";
          const apiBase = (configuredApiBase.includes("dodopayments.com") ? configuredApiBase : "https://live.dodopayments.com").replace(/\/$/, "");
          const isPass = plan === "pass3day";
          const productId = isPass ? getPass3DayProductId() : getPlanProductId(plan);
          const discountCodes = isPass ? [] : [BILLING_PLANS[plan].discountCode];
          const reqUrl = new URL(request.url);
          const appBase = (process.env.APP_BASE_URL ?? reqUrl.origin).replace(/\/$/, "");
          const returnUrl = `${appBase}/payment/return?plan=${encodeURIComponent(plan)}`;

          const basePayload: Record<string, unknown> = {
            product_cart: [{ product_id: productId, quantity: 1 }],
            customer: { email, name: name || email.split("@")[0] },
            billing_currency: "USD",
            return_url: returnUrl,
            metadata: { plan, email },
          };

          async function callDodo(withDiscount: boolean) {
            const body = withDiscount && discountCodes.length
              ? { ...basePayload, discount_codes: discountCodes }
              : basePayload;
            const resp = await fetch(`${apiBase}/checkouts`, {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
              body: JSON.stringify(body),
            });
            const raw = await resp.text();
            let parsed: unknown = null;
            if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } }
            return { ok: resp.ok, status: resp.status, json: parsed as any };
          }

          let r = await callDodo(true);
          // Auto-retry without discount if Dodo rejects the discount code.
          if (!r.ok && discountCodes.length) {
            const blob = typeof r.json === "string" ? r.json : JSON.stringify(r.json ?? "");
            if (/discount/i.test(blob) || r.status === 400 || r.status === 404 || r.status === 422) {
              r = await callDodo(false);
            }
          }

          if (!r.ok) {
            const detailMsg =
              (typeof r.json === "object" && r.json && (r.json.error?.message || r.json.message || r.json.error)) ||
              (typeof r.json === "string" ? r.json : "Failed to create checkout session");
            return new Response(JSON.stringify({ error: String(detailMsg).slice(0, 400), status: r.status, details: r.json }), {
              status: 502,
              headers: { "content-type": "application/json" },
            });
          }
          const json = r.json;

          const paymentLink =
            json?.payment_link ??
            json?.data?.payment_link ??
            json?.checkout_url ??
            json?.data?.checkout_url;

          if (!paymentLink || typeof paymentLink !== "string") {
            return new Response(JSON.stringify({ error: "Dodo response missing payment link", details: json }), {
              status: 502,
              headers: { "content-type": "application/json" },
            });
          }

          return Response.json({ payment_link: paymentLink });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
