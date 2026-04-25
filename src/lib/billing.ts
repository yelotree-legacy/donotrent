// Stripe Billing integration. Three operations:
//   - createCheckoutSession(plan, company, returnUrls) → starts a Stripe
//     hosted checkout for the chosen subscription plan.
//   - createPortalSession(company, returnUrl) → opens the Stripe Customer
//     Portal so the customer can manage their subscription.
//   - syncSubscription(stripeSubscription | event) → mirror Stripe state into
//     our Company row when a subscription event arrives.

import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { prisma } from "./db";
import { PLANS, getPlan, priceIdForPlan, type Plan } from "./plans";
import { logAudit } from "./audit";

export async function createCheckoutSession(opts: {
  company: { id: string; email: string; name: string; stripeCustomerId: string | null };
  plan: Plan;
  successUrl: string;
  cancelUrl: string;
}) {
  const priceId = priceIdForPlan(opts.plan);
  if (!priceId) {
    throw new Error(
      `No Stripe price ID for plan ${opts.plan.slug}. Set ${opts.plan.stripePriceEnvVar} in env.`
    );
  }

  const stripe = getStripe();
  let customerId = opts.company.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: opts.company.email,
      name: opts.company.name,
      metadata: { company_id: opts.company.id },
    });
    customerId = customer.id;
    await prisma.company.update({
      where: { id: opts.company.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: { company_id: opts.company.id, plan: opts.plan.slug },
    subscription_data: {
      metadata: { company_id: opts.company.id, plan: opts.plan.slug },
    },
    allow_promotion_codes: true,
  });

  await logAudit("billing.checkout_started", opts.company.id, { plan: opts.plan.slug });
  return session;
}

export async function createPortalSession(opts: {
  company: { id: string; stripeCustomerId: string | null };
  returnUrl: string;
}) {
  if (!opts.company.stripeCustomerId) {
    throw new Error("Company has no Stripe customer yet — subscribe to a plan first.");
  }
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: opts.company.stripeCustomerId,
    return_url: opts.returnUrl,
  });
}

export async function syncSubscription(sub: Stripe.Subscription) {
  const companyId = (sub.metadata?.company_id as string) || null;
  if (!companyId) {
    // Look up by stripeSubscriptionId
    const co = await prisma.company.findUnique({ where: { stripeSubscriptionId: sub.id } });
    if (!co) return;
    return applySubscription(co.id, sub);
  }
  return applySubscription(companyId, sub);
}

async function applySubscription(companyId: string, sub: Stripe.Subscription) {
  // Map the price ID back to a plan slug
  const priceId = sub.items.data[0]?.price.id;
  const planSlug = (Object.values(PLANS).find((p) => priceIdForPlan(p) === priceId)?.slug)
    ?? (sub.metadata?.plan as string)
    ?? "starter";

  const status = sub.status; // active | trialing | past_due | canceled | incomplete | unpaid

  // If the period rolled over, reset the counter.
  const co = await prisma.company.findUnique({
    where: { id: companyId },
    select: { currentPeriodEnd: true },
  });
  const newPeriodEnd = new Date(sub.current_period_end * 1000);
  const periodChanged = !co?.currentPeriodEnd || newPeriodEnd.getTime() !== co.currentPeriodEnd.getTime();

  await prisma.company.update({
    where: { id: companyId },
    data: {
      plan: status === "canceled" ? "free" : planSlug,
      stripeStatus: status,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: newPeriodEnd,
      ...(periodChanged ? { checksUsedThisPeriod: 0 } : {}),
    },
  });

  await logAudit(`billing.${status}`, companyId, { subscriptionId: sub.id, plan: planSlug });
}

export async function cancelSubscription(stripeSubscriptionId: string) {
  // Used when a customer.subscription.deleted webhook arrives.
  const co = await prisma.company.findUnique({ where: { stripeSubscriptionId } });
  if (!co) return;
  await prisma.company.update({
    where: { id: co.id },
    data: { plan: "free", stripeStatus: "canceled" },
  });
  await logAudit("billing.canceled", co.id, { subscriptionId: stripeSubscriptionId });
}
