// Stripe Identity webhook receiver. Verifies the signature, then dispatches
// to applyVerificationEvent which mutates the CheckSession.

import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { applyVerificationEvent } from "@/lib/idv";
import type Stripe from "stripe";

export const runtime = "nodejs"; // need the raw body
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) return new NextResponse("Stripe not configured", { status: 501 });
  const sig = headers().get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig) return new NextResponse("Missing signature", { status: 400 });
  if (!secret) return new NextResponse("STRIPE_WEBHOOK_SECRET not set", { status: 500 });

  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e: any) {
    return new NextResponse(`Bad signature: ${e?.message || e}`, { status: 400 });
  }

  if (event.type.startsWith("identity.verification_session.")) {
    try {
      await applyVerificationEvent(event);
    } catch (e: any) {
      console.error("[idv webhook] failed to apply event", event.type, e);
      // Return 200 anyway so Stripe doesn't endlessly retry on app bugs.
    }
  }

  return NextResponse.json({ received: true });
}
