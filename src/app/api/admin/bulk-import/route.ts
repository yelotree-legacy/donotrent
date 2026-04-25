import { NextRequest, NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { commitBulkImport, validateRows, unknownHeaders } from "@/lib/bulk-import";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET: return list of sources for the dropdown.
export async function GET() {
  const me = await requireCompany();
  if (!me?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sources = await prisma.source.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, kind: true, _count: { select: { entries: true } } },
  });
  return NextResponse.json({ sources });
}

// POST: { mode: "validate" | "commit", sourceId | newSource: {...}, headers, rows }
export async function POST(req: NextRequest) {
  const me = await requireCompany();
  if (!me?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const headers = Array.isArray(body.headers) ? body.headers as string[] : [];
  const rows = Array.isArray(body.rows) ? body.rows as Record<string, string>[] : [];
  if (rows.length === 0) return NextResponse.json({ error: "No rows" }, { status: 400 });
  if (rows.length > 5000) return NextResponse.json({ error: "Max 5000 rows per import" }, { status: 400 });

  const validated = validateRows(rows);
  const unknown = unknownHeaders(headers);

  // Validate-only mode: just return the preview
  if (body.mode === "validate") {
    return NextResponse.json({
      mode: "validate",
      headers,
      unknown_headers: unknown,
      rows: validated.map((v) => ({
        rowIndex: v.rowIndex,
        ok: v.ok,
        error: v.error,
        preview: v.data ? {
          fullName: v.data.fullName,
          licenseId: v.data.licenseId,
          licenseState: v.data.licenseState,
          severity: v.data.severity,
          primaryReason: v.data.primaryReason,
          categories: v.data.categories,
          photoUrl: v.data.photoUrl,
        } : null,
      })),
      summary: {
        total: validated.length,
        valid: validated.filter((v) => v.ok).length,
        invalid: validated.filter((v) => !v.ok).length,
      },
    });
  }

  // Commit mode
  let sourceId: string | undefined = body.sourceId;

  if (!sourceId && body.newSource) {
    const ns = body.newSource;
    const slug = String(ns.slug || ns.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) return NextResponse.json({ error: "newSource.slug required" }, { status: 400 });
    const created = await prisma.source.create({
      data: {
        slug,
        name: String(ns.name || slug),
        kind: ns.kind || "manual",
        url: ns.url || null,
        region: ns.region || null,
        description: ns.description || null,
        trustScore: Math.min(100, Math.max(0, Number(ns.trustScore) || 70)),
        syncFrequency: "manual",
        isActive: true,
        lastSyncedAt: new Date(),
      },
    });
    sourceId = created.id;
  }

  if (!sourceId) return NextResponse.json({ error: "sourceId or newSource required" }, { status: 400 });

  const okRows = validated.filter((v) => v.ok && v.data).map((v) => v.data!);
  if (okRows.length === 0) return NextResponse.json({ error: "No valid rows to commit" }, { status: 400 });

  const result = await commitBulkImport({ sourceId, createdById: me.id, rows: okRows });
  await logAudit("bulk_import.commit", sourceId, {
    created: result.created,
    updated: result.updated,
    failed: result.failed,
  });

  // Update lastSyncedAt on the source
  await prisma.source.update({ where: { id: sourceId }, data: { lastSyncedAt: new Date() } });

  return NextResponse.json({
    mode: "commit",
    sourceId,
    ...result,
    skipped_invalid: validated.length - okRows.length,
  });
}
