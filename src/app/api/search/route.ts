import { NextRequest, NextResponse } from "next/server";
import { searchEntries } from "@/lib/search";
import { logSearch } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const field = (sp.get("field") as any) ?? "any";
  const limit = Math.min(parseInt(sp.get("limit") ?? "20", 10), 100);
  const offset = parseInt(sp.get("offset") ?? "0", 10);
  const cats = sp.getAll("cat");
  const severity = sp.getAll("severity");
  const status = sp.getAll("status");

  const result = await searchEntries({
    query: q,
    field,
    limit,
    offset,
    categories: cats,
    severity,
    status,
  });

  if (q) await logSearch(q, field, result.hits.length);

  return NextResponse.json({
    total: result.total,
    hits: result.hits.map((h) => ({
      id: h.id,
      fullName: h.fullName,
      licenseId: h.licenseId,
      severity: h.severity,
      status: h.status,
      categories: h.categories,
      reason: h.primaryReason,
      matchKind: h.matchKind,
      score: h.score,
    })),
  });
}
