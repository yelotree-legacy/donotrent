import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth";
import { syncOfacList, getOfacCacheInfo, checkOfac } from "@/lib/checks/ofac";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const me = await requireCompany();
  if (!me?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(getOfacCacheInfo());
}

export async function POST() {
  const me = await requireCompany();
  if (!me?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const result = await syncOfacList();
    // Warm-up call so the cached list is ready immediately
    await checkOfac("test pre-warm").catch(() => {});
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Sync failed" }, { status: 500 });
  }
}
