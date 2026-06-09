export type BillingPlan = "starter" | "growth" | "agency";
export type CheckoutPlan = BillingPlan | "pass3day";


type PlanDef = {
  key: BillingPlan;
  label: string;
  monthlyPriceCents: number;
  monthlyPriceLabel: string;
  discountCode: string;
  earlyUserSeats: number;
  limits: {
    keywords: number;
    competitors: number;
    projects: number | "unlimited";
  };
};

export const BILLING_PLANS: Record<BillingPlan, PlanDef> = {
  starter: {
    key: "starter",
    label: "Starter",
    monthlyPriceCents: 1800,
    monthlyPriceLabel: "$18",
    discountCode: "STARTER50",
    earlyUserSeats: 45,
    limits: { keywords: 10, competitors: 3, projects: 1 },
  },
  growth: {
    key: "growth",
    label: "Growth",
    monthlyPriceCents: 4700,
    monthlyPriceLabel: "$47",
    discountCode: "GROWTH50",
    earlyUserSeats: 27,
    limits: { keywords: 30, competitors: 9, projects: 3 },
  },
  agency: {
    key: "agency",
    label: "Agency",
    monthlyPriceCents: 7900,
    monthlyPriceLabel: "$79",
    discountCode: "AGENCY50",
    earlyUserSeats: 9,
    limits: { keywords: 50, competitors: 15, projects: "unlimited" },
  },
};
const DEFAULT_PLAN_PRODUCT_IDS: Record<BillingPlan, string> = {
  starter: "pdt_0NfVPScA9WSdQj7TAtYAW",
  growth: "pdt_0NfVPbzjI0fWQLY96Rn3C",
  agency: "pdt_0NfVPl0QMPx0TYiuc7sFA",
};

const DEFAULT_PASS3DAY_PRODUCT_ID = "pdt_PASS3DAY_PLACEHOLDER";

export function getPass3DayProductId(): string {
  return process.env.DODO_PRODUCT_PASS3DAY_ID ?? DEFAULT_PASS3DAY_PRODUCT_ID;
}




export function formatUsdCents(valueCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: valueCents % 100 === 0 ? 0 : 2,
  }).format(valueCents / 100);
}

export function getDiscountedPriceLabel(valueCents: number) {
  return formatUsdCents(Math.round(valueCents / 2));
}

export function getYearlyPriceLabel(monthlyPriceCents: number) {
  const earlyBirdMonthly = Math.round(monthlyPriceCents * 0.5);
  return formatUsdCents(Math.round(earlyBirdMonthly * 12 * 0.8));
}

export function parseBillingPlan(value: unknown): BillingPlan {
  const raw = typeof value === "string" ? value.toLowerCase() : "";
  if (raw === "starter" || raw === "growth" || raw === "agency") return raw;
  throw new Error("Invalid plan. Expected starter, growth, or agency.");
}

export function parseCheckoutPlan(value: unknown): CheckoutPlan {
  const raw = typeof value === "string" ? value.toLowerCase() : "";
  if (raw === "pass3day") return "pass3day";
  return parseBillingPlan(value);
}


export function getPlanProductId(plan: BillingPlan): string {
  const envMap: Record<BillingPlan, string | undefined> = {
    starter: process.env.DODO_PRODUCT_STARTER_ID,
    growth: process.env.DODO_PRODUCT_GROWTH_ID,
    agency: process.env.DODO_PRODUCT_AGENCY_ID,
  };
  const id = envMap[plan];
  if (!id) {
    return DEFAULT_PLAN_PRODUCT_IDS[plan];
  }
  if (id === DEFAULT_PLAN_PRODUCT_IDS[plan]) return id;
  if (id === DEFAULT_PLAN_PRODUCT_IDS.starter && plan === "starter") return id;
  if (id === DEFAULT_PLAN_PRODUCT_IDS.growth && plan === "growth") return id;
  if (id === DEFAULT_PLAN_PRODUCT_IDS.agency && plan === "agency") return id;
  return DEFAULT_PLAN_PRODUCT_IDS[plan];
}

export function getProjectLimitLabel(projects: number | "unlimited") {
  return projects === "unlimited" ? "Unlimited" : String(projects);
}

// One-time, time-boxed access pass. Kept separate from BILLING_PLANS so that
// subscription tiers, limits, and discount logic stay strictly untouched.
export const THREE_DAY_PASS = {
  key: "pass3day",
  label: "3-Day Pass",
  priceCents: 500,
  priceLabel: "$5",
  durationDays: 3,
  description:
    "Full access to all inbound features for 3 days. Outbound (Auto DMs) not included. One-time payment, no subscription.",
  features: [
    "All inbound monitoring features",
    "AI scoring + relevance filters",
    "Competitor mention tracking",
    "SEO + parasite SEO opportunities",
    "Analytics dashboard",
    "3 days of full access",
  ],
} as const;
