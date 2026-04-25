// Stripe Billing webhook. Subscribes to subscription + invoice events and
// mirrors them into our Company row.

import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { syncSubscription, cancelSubscription } from "@/lib/billing";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) return new NextResponse("Stripe not configured", { status: 501 });

  const sig = headers().get("stripe-signature");
  // Use the same webhook secret as IDV by default — operators can split if needed.
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig) return new NextResponse("Missing signature", { status: 400 });
  if (!secret) return new NextResponse("Webhook secret not set", { status: 500 });

  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e: any) {
    return new NextResponse(`Bad signature: ${e?.message || e}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.trial_will_end": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await cancelSubscription(sub.id);
        break;
      }
      // invoice.* events — could be used for dunning emails. No-op for now.
    }
  } catch (e: any) {
    console.error("[billing webhook]", event.type, e);
  }

  return NextResponse.json({ received: true });
}
