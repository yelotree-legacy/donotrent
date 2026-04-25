import { NextRequest, NextResponse } from "next/server";
import { createVerificationSession } from "@/lib/idv";
import { isStripeConfigured } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe Identity is not configured. Set STRIPE_SECRET_KEY in the environment." },
      { status: 501 }
    );
  }
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const checkId = String(body.checkId || "");
  if (!checkId) return NextResponse.json({ error: "checkId required" }, { status: 400 });

  const origin = req.nextUrl.origin;
  const returnUrl = `${origin}/check/${checkId}?idv=complete`;

  try {
    const result = await createVerificationSession({ checkId, returnUrl });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create verification session" }, { status: 500 });
  }
}
