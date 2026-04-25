import { NextRequest, NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/billing";
import { getPlan, priceIdForPlan } from "@/lib/plans";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 501 });
  }
  const me = await requireCompany();
  if (!me) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const planSlug = String(body.plan || "");
  const plan = getPlan(planSlug);
  if (plan.slug === "free" || plan.slug === "enterprise") {
    return NextResponse.json({ error: "Plan not purchasable via self-serve checkout." }, { status: 400 });
  }
  if (!priceIdForPlan(plan)) {
    return NextResponse.json({
      error: `Stripe Price ID not set. Add ${plan.stripePriceEnvVar} to env.`,
    }, { status: 503 });
  }

  const origin = req.nextUrl.origin;
  try {
    const session = await createCheckoutSession({
      company: { id: me.id, email: me.email, name: me.name, stripeCustomerId: me.stripeCustomerId },
      plan,
      successUrl: `${origin}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/pricing?checkout=canceled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Checkout failed" }, { status: 500 });
  }
}
