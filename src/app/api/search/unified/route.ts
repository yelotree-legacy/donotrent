// Unified search: returns DNR entries AND brokers matching a query in one
// response. Used by the LiveSearch dropdown and the /search page so a single
// input surfaces hits from both registries.

import { NextRequest, NextResponse } from "next/server";
import { searchEntries } from "@/lib/search";
import { searchBrokers } from "@/lib/brokers";
import { logSearch } from "@/lib/audit";
import { rateLimit, getClientIp, Limits } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  // Rate limit by IP — fail-open so a flaky DB doesn't kill search
  const ip = getClientIp();
  const rl = await rateLimit({ key: `search:${ip}`, ...Limits.searchByIp });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const field = (sp.get("field") as any) ?? "any";
  const limitEntries = Math.min(parseInt(sp.get("entry_limit") ?? "8", 10), 50);
  const limitBrokers = Math.min(parseInt(sp.get("broker_limit") ?? "5", 10), 30);

  const [entryResult, brokers] = await Promise.all([
    searchEntries({ query: q, field, limit: limitEntries }),
    q ? searchBrokers(q, limitBrokers) : Promise.resolve([]),
  ]);

  if (q) await logSearch(q, field, entryResult.hits.length + brokers.length);

  return NextResponse.json({
    query: q,
    entries: {
      total: entryResult.total,
      hits: entryResult.hits.map((h) => ({
        type: "renter" as const,
        id: h.id,
        url: `/entry/${h.id}`,
        fullName: h.fullName,
        licenseId: h.licenseId,
        licenseState: h.licenseState,
        severity: h.severity,
        status: h.status,
        primaryReason: h.primaryReason,
        matchKind: h.matchKind,
        thumbnailUrl: h.thumbnailUrl,
      })),
    },
    brokers: {
      total: brokers.length,
      hits: brokers.map((b) => ({
        type: "broker" as const,
        id: b.id,
        url: `/brokers/${b.slug}`,
        name: b.name,
        city: b.city,
        state: b.state,
        avgRating: b.avgRating,
        reviewCount: b.reviewCount,
        description: b.description,
      })),
    },
  });
}
