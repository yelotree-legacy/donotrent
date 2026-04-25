// Checkr webhook receiver. Checkr POSTs report.* events when the report
// flips status; we mirror to CheckSession.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isCheckrConfigured, getCheckrReport, summarizeCheckrReport } from "@/lib/checks/checkr";
import { logAudit } from "@/lib/audit";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isCheckrConfigured()) return new NextResponse("Checkr not configured", { status: 501 });

  const body = await req.text();
  const sig = req.headers.get("x-checkr-signature");
  const secret = process.env.CHECKR_WEBHOOK_SECRET;

  // Optional signature verification — Checkr signs with HMAC-SHA256 over
  // the raw body using the webhook secret.
  if (secret) {
    if (!sig) return new NextResponse("Missing signature", { status: 400 });
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (!safeEqual(sig, expected)) return new NextResponse("Bad signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const type = event.type as string | undefined;
  const data = event.data?.object;
  if (!type || !type.startsWith("report.") || !data?.id) {
    return NextResponse.json({ received: true });
  }

  try {
    // Refetch the canonical report to be safe
    const report = await getCheckrReport(data.id);
    const findings = summarizeCheckrReport(report);
    const status = report.status; // pending | clear | consider | suspended
    await prisma.checkSession.update({
      where: { checkrReportId: report.id },
      data: {
        checkrStatus: status,
        checkrAdjudication: report.adjudication ?? null,
        checkrFindingsJson: JSON.stringify(findings),
        checkrCompletedAt: status === "clear" || status === "consider" || status === "suspended" ? new Date() : null,
      },
    });
    await logAudit(`checkr.${status}`, "", { reportId: report.id });
  } catch (e) {
    console.error("[checkr webhook]", e);
  }

  return NextResponse.json({ received: true });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
