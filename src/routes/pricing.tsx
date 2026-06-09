import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { BILLING_PLANS, THREE_DAY_PASS, getDiscountedPriceLabel, getProjectLimitLabel, getYearlyPriceLabel } from "@/lib/billing.config";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";

const SITE_URL = "https://redscout.tech";

const PRICING_FAQS = [
  { q: "Can I cancel anytime?", a: "Yes. Every subscription can be canceled in one click from your Billing page. No phone calls, no retention dance." },
  { q: "What is the 50% early-bird discount?", a: "While we're in launch mode, every monthly plan is 50% off forever for early users. Yearly stacks an extra 20% on top." },
  { q: "What is the 3-Day Pass?", a: "A $5 one-time payment that unlocks every inbound feature for 3 days — perfect to test redScout before committing to a subscription. Outbound DMs are not included." },
  { q: "Do you offer refunds?", a: "Yes — money-back guarantee on every subscription if redScout isn't a fit." },
  { q: "Will my limits change later?", a: "No. The keyword, competitor and project limits per plan are locked in. We only add features, not restrictions." },
  { q: "Is there a free trial?", a: "The 3-Day Pass at $5 is effectively a paid micro-trial — full inbound access, no commitment." },
  { q: "Can I upgrade or downgrade?", a: "Yes, anytime from your dashboard. Pro-rated to the day." },
  { q: "Do you support agencies?", a: "The Agency plan unlocks unlimited projects, 50 keywords, 15 competitors, and seat sharing." },
];

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — redScout | From $5 · 50% Early-Bird Off" },
      { name: "description", content: "Simple, founder-friendly pricing for redScout. Plans from $9/mo with 50% early-bird off, yearly extra 20%, $5 3-Day Pass, cancel anytime." },
      { property: "og:title", content: "Pricing — redScout" },
      { property: "og:description", content: "Plans from $9/mo with 50% early-bird off, $5 3-Day Pass, cancel anytime." },
      { property: "og:url", content: `${SITE_URL}/pricing` },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "redScout" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pricing` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: PRICING_FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "redScout",
          description: "Reddit growth OS for founders.",
          brand: { "@type": "Brand", name: "redScout" },
          offers: [
            ...Object.values(BILLING_PLANS).map((p) => ({
              "@type": "Offer",
              name: p.label,
              price: (p.monthlyPriceCents / 200).toFixed(2),
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              url: `${SITE_URL}/pricing`,
            })),
            {
              "@type": "Offer",
              name: THREE_DAY_PASS.label,
              price: (THREE_DAY_PASS.priceCents / 100).toFixed(2),
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              url: `${SITE_URL}/pricing`,
            },
          ],
        }),
      },
    ],
  }),
});

function PricingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,95,45,0.12),_transparent_28%),linear-gradient(180deg,#fffaf5_0%,#fffdfb_48%,#fff8f2_100%)] text-foreground">
      <MarketingHeader />


      <main>
        <section className="mx-auto max-w-7xl px-6 pt-20 pb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-primary">
            50% off · Early Bird · Cancel Anytime
          </span>
          <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight">Crazy launch <span className="text-primary">pricing</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Plans from $9/mo. Yearly stacks an extra 20% off. $5 3-Day Pass to test everything inbound. Cancel anytime.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-10">
          <div className="grid gap-4 md:grid-cols-3">
            {Object.values(BILLING_PLANS).map((plan) => (
              <div key={plan.key} className="relative rounded-[1.75rem] border border-border/70 bg-white/85 p-7 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.45)] backdrop-blur">
                <p className="label-eyebrow text-primary">{plan.label}</p>
                <p className="mt-4 flex items-baseline gap-3">
                  <span className="text-lg line-through text-muted-foreground">{plan.monthlyPriceLabel}</span>
                  <span className="text-5xl font-bold tracking-tight">{getDiscountedPriceLabel(plan.monthlyPriceCents)}<span className="text-base font-medium text-muted-foreground">/mo</span></span>
                </p>
                <p className="mt-2 text-xs font-semibold text-primary">50% early-bird · Yearly {getYearlyPriceLabel(plan.monthlyPriceCents)}/yr</p>
                <ul className="mt-6 space-y-2 text-sm">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> {plan.limits.keywords} tracked keywords</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> {plan.limits.competitors} tracked competitors</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> {getProjectLimitLabel(plan.limits.projects)} project(s)</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> AI scoring + relevance filters</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> Competitor mention tracking</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> SEO + parasite SEO opportunities</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> Warmup + safe gradual limits</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> Daily streak + gamified targets</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> Detailed analytics + simulations</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> DM extension + CRM outreach</li>
                  <li className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> Cancel anytime</li>
                </ul>
                <Link to="/signup" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full border border-foreground bg-foreground px-5 py-3 text-sm font-bold uppercase tracking-wider text-background">
                  Get customers from Reddit <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-20">
          <div className="rounded-[1.75rem] border border-primary/30 bg-white/90 p-7 text-center shadow-[0_24px_80px_-50px_rgba(15,23,42,0.45)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">{THREE_DAY_PASS.label}</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">Just want a taste? <span className="text-primary">$5</span> for 3 days.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">{THREE_DAY_PASS.description}</p>
            <ul className="mx-auto mt-5 grid max-w-md gap-2 text-left text-sm">
              {THREE_DAY_PASS.features.map((f) => (
                <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> {f}</li>
              ))}
            </ul>
            <Link to="/signup" search={{ plan: THREE_DAY_PASS.key } as never} className="mt-6 inline-flex items-center gap-2 rounded-full border border-foreground bg-foreground px-6 py-3 text-sm font-bold uppercase tracking-wider text-background">
              Get the 3-Day Pass <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-24">
          <h2 className="text-center text-3xl font-bold tracking-tight">Pricing FAQ</h2>
          <div className="mt-8 divide-y divide-border rounded-[1.5rem] border border-border/70 bg-white/85 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.4)]">
            {PRICING_FAQS.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="cursor-pointer list-none text-sm font-bold">
                  {f.q}
                  <span className="float-right transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

