import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("checkId");
  if (!id) return NextResponse.json({ error: "checkId required" }, { status: 400 });
  const c = await prisma.checkSession.findUnique({
    where: { id },
    select: {
      checkrStatus: true,
      checkrAdjudication: true,
      checkrFindingsJson: true,
      checkrCompletedAt: true,
      checkrReportId: true,
    },
  });
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(c);
}
