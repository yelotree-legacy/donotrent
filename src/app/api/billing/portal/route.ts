import { NextRequest, NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { createPortalSession } from "@/lib/billing";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  const me = await requireCompany();
  if (!me) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!me.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer — subscribe first." }, { status: 400 });
  }
  try {
    const portal = await createPortalSession({
      company: { id: me.id, stripeCustomerId: me.stripeCustomerId },
      returnUrl: `${req.nextUrl.origin}/dashboard/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Portal failed" }, { status: 500 });
  }
}
