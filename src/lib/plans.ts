// Plan definitions. Server-side authoritative. Stripe Price IDs come from
// env vars so the same code works against test- and live-mode Stripe.

export type PlanSlug = "free" | "starter" | "pro" | "pro_plus" | "enterprise";

// Slugs shown on the public pricing page (in order).
export const PUBLIC_PLAN_SLUGS: PlanSlug[] = ["starter", "pro", "pro_plus"];

export type Plan = {
  slug: PlanSlug;
  label: string;
  monthlyPrice: number; // USD, 0 for free / undefined for enterprise
  trialChecks?: number; // total free checks for the trial plan
  monthlyChecks: number; // checks included per period (0 = unlimited)
  apiAccess: boolean;
  teamSeats: number; // 0 = unlimited
  prioritySupport: boolean;
  description: string;
  features: string[];
  stripePriceEnvVar?: string; // e.g. STRIPE_PRICE_PRO
  cta: "Start trial" | "Choose plan" | "Contact sales";
  highlight?: boolean;
};

export const PLANS: Record<PlanSlug, Plan> = {
  free: {
    slug: "free",
    label: "Trial",
    monthlyPrice: 0,
    trialChecks: 10,
    monthlyChecks: 0,
    apiAccess: false,
    teamSeats: 1,
    prioritySupport: false,
    description: "Try the platform before committing.",
    features: [
      "10 Rent Reports total",
      "Multi-source cross-check",
      "Stripe Identity verification",
      "Manual checks via dashboard",
    ],
    cta: "Start trial",
  },
  starter: {
    slug: "starter",
    label: "Starter",
    monthlyPrice: 49,
    monthlyChecks: 25,
    apiAccess: false,
    teamSeats: 1,
    prioritySupport: false,
    description: "For solo operators and small fleets.",
    features: [
      "25 Rent Reports / month",
      "Multi-source cross-check",
      "Stripe Identity verification",
      "Email support",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_STARTER",
    cta: "Choose plan",
  },
  pro: {
    slug: "pro",
    label: "Pro",
    monthlyPrice: 149,
    monthlyChecks: 100,
    apiAccess: true,
    teamSeats: 3,
    prioritySupport: false,
    description: "For growing rental operations.",
    features: [
      "100 Rent Reports / month",
      "API access — integrate into your booking flow",
      "3 team seats",
      "Stripe Identity included",
      "Search alerts (notify when flagged renter is searched)",
      "Email support",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_PRO",
    cta: "Choose plan",
    highlight: true,
  },
  pro_plus: {
    slug: "pro_plus",
    label: "Pro+",
    monthlyPrice: 399,
    monthlyChecks: 500,
    apiAccess: true,
    teamSeats: 10,
    prioritySupport: true,
    description: "For multi-location and high-volume operators.",
    features: [
      "500 Rent Reports / month",
      "API access with higher rate limits",
      "10 team seats",
      "Stripe Identity + Checkr included",
      "OFAC + sex offender screening",
      "Search alerts + Slack/email webhooks",
      "Priority support",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_PRO_PLUS",
    cta: "Choose plan",
  },
  enterprise: {
    slug: "enterprise",
    label: "Enterprise",
    monthlyPrice: 0, // custom — shown as "Contact sales"
    monthlyChecks: 0, // 0 = unlimited (server-side check skips limit)
    apiAccess: true,
    teamSeats: 0,
    prioritySupport: true,
    description: "For networks, franchises, and integrators.",
    features: [
      "Unlimited Rent Reports",
      "Unlimited team seats",
      "Dedicated account manager",
      "SLA + custom data residency",
      "White-label option",
    ],
    cta: "Contact sales",
  },
};

export function getPlan(slug: string | null | undefined): Plan {
  return PLANS[(slug as PlanSlug) || "free"] || PLANS.free;
}

export function quotaForPlan(plan: Plan): { limit: number; isUnlimited: boolean; isTrial: boolean } {
  if (plan.slug === "free") return { limit: plan.trialChecks ?? 10, isUnlimited: false, isTrial: true };
  if (plan.monthlyChecks === 0) return { limit: 0, isUnlimited: true, isTrial: false };
  return { limit: plan.monthlyChecks, isUnlimited: false, isTrial: false };
}

export function checksRemaining(company: {
  plan: string;
  checksUsedThisPeriod: number;
}): { remaining: number; limit: number; isUnlimited: boolean } {
  const plan = getPlan(company.plan);
  const q = quotaForPlan(plan);
  if (q.isUnlimited) return { remaining: Infinity, limit: 0, isUnlimited: true };
  return {
    remaining: Math.max(0, q.limit - company.checksUsedThisPeriod),
    limit: q.limit,
    isUnlimited: false,
  };
}

export function priceIdForPlan(plan: Plan): string | undefined {
  if (!plan.stripePriceEnvVar) return undefined;
  // Backwards-compat: if old STRIPE_PRICE_BUSINESS is still set, accept it
  // for the renamed Pro+ slug.
  if (plan.slug === "pro_plus") {
    return process.env.STRIPE_PRICE_PRO_PLUS || process.env.STRIPE_PRICE_BUSINESS;
  }
  return process.env[plan.stripePriceEnvVar];
}
