import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/auth";
import { isCheckrConfigured, createCheckrCandidate, createCheckrReport } from "@/lib/checks/checkr";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isCheckrConfigured()) {
    return NextResponse.json({ error: "Checkr not configured. Set CHECKR_API_KEY." }, { status: 501 });
  }
  const me = await requireCompany();
  if (!me) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const checkId = String(body.checkId || "");
  if (!checkId) return NextResponse.json({ error: "checkId required" }, { status: 400 });

  const session = await prisma.checkSession.findUnique({ where: { id: checkId } });
  if (!session) return NextResponse.json({ error: "Check session not found" }, { status: 404 });
  if (!session.fullName) return NextResponse.json({ error: "Full name required for criminal check" }, { status: 400 });

  // Already started?
  if (session.checkrReportId) {
    return NextResponse.json({
      reportId: session.checkrReportId,
      status: session.checkrStatus,
      message: "Already running",
    });
  }

  try {
    const candidate = await createCheckrCandidate({
      fullName: session.fullName,
      dateOfBirth: session.dateOfBirth?.toISOString().slice(0, 10),
      driverLicenseNumber: session.licenseId || undefined,
      driverLicenseState: undefined,
    });
    const report = await createCheckrReport({ candidateId: candidate.id });
    await prisma.checkSession.update({
      where: { id: checkId },
      data: {
        checkrCandidateId: candidate.id,
        checkrReportId: report.id,
        checkrStatus: "pending",
      },
    });
    await logAudit("checkr.started", checkId, { reportId: report.id });
    return NextResponse.json({ reportId: report.id, status: "pending" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Checkr request failed" }, { status: 500 });
  }
}
