// Multi-source DNR aggregation. Given a candidate (license_id and/or full
// name and/or DOB), query EVERY active source and roll the matches up into
// a single Rent Report verdict.

import { prisma } from "./db";
import { normalizeLicense, normalizeName, scoreName } from "./normalize";

export type CrossCheckInput = {
  licenseId?: string;
  fullName?: string;
  dateOfBirth?: string; // YYYY-MM-DD
};

export type SourceMatchSummary = {
  sourceId: string;
  sourceSlug: string;
  sourceName: string;
  sourceKind: string;
  sourceTrustScore: number;
  hits: number;
  worstSeverity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
  entryIds: string[];
};

export type CrossCheckResult = {
  query: CrossCheckInput;
  totalSources: number;
  matchedSources: number;
  totalHits: number;
  worstSeverity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
  verdict: "DECLINE" | "REVIEW" | "APPROVE";
  riskScore: number; // 0-100, lower is safer
  sources: SourceMatchSummary[];
  hits: HitDetail[];
};

export type HitDetail = {
  id: string;
  fullName: string;
  licenseId: string | null;
  licenseState: string | null;
  primaryReason: string;
  severity: string;
  damageAmount: number | null;
  status: string;
  matchedOn: ("license" | "name" | "dob")[];
  thumbnailUrl: string | null;
  source: { id: string; slug: string; name: string; kind: string } | null;
};

const SEVERITY_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

// Cache active sources in-process for 5 min to avoid hitting the DB on
// every cross-check. The Source list is rarely updated; if an admin adds
// or deactivates a source it'll be picked up after the cache expires.
type CachedSources = { rows: Awaited<ReturnType<typeof prisma.source.findMany>>; loadedAt: number };
let cachedSources: CachedSources | null = null;
const SOURCE_CACHE_TTL_MS = 5 * 60 * 1000;

async function getCachedActiveSources() {
  if (cachedSources && Date.now() - cachedSources.loadedAt < SOURCE_CACHE_TTL_MS) {
    return cachedSources.rows;
  }
  const rows = await prisma.source.findMany({
    where: { isActive: true },
    orderBy: { trustScore: "desc" },
  });
  cachedSources = { rows, loadedAt: Date.now() };
  return rows;
}

export async function crossCheck(input: CrossCheckInput): Promise<CrossCheckResult> {
  const lic = input.licenseId?.trim() || "";
  const name = input.fullName?.trim() || "";
  const dob = input.dateOfBirth ? new Date(input.dateOfBirth) : null;

  const licNorm = lic ? normalizeLicense(lic) : "";
  const nameNorm = name ? normalizeName(name) : "";

  const orConds: any[] = [];
  if (licNorm.length >= 4) orConds.push({ licenseIdNorm: licNorm });
  if (nameNorm.length >= 2) {
    // Exact normalized match OR substring
    orConds.push({ fullNameNorm: nameNorm });
    orConds.push({ fullNameNorm: { contains: nameNorm } });
    orConds.push({ aliases: { contains: name } });
  }
  if (dob) orConds.push({ dateOfBirth: dob });

  const allSources = await getCachedActiveSources();

  let candidates: any[] = [];
  if (orConds.length) {
    candidates = await prisma.dnrEntry.findMany({
      where: { OR: orConds },
      include: {
        source: true,
        photos: { take: 1, orderBy: { createdAt: "asc" } },
      },
      take: 200,
    });
  }

  // Filter fuzzy name candidates: keep substring/exact, drop unrelated
  const filtered = candidates.filter((c) => {
    if (licNorm && c.licenseIdNorm === licNorm) return true;
    if (nameNorm && c.fullNameNorm === nameNorm) return true;
    if (nameNorm && scoreName(nameNorm, c.fullNameNorm) >= 600) return true;
    if (dob && c.dateOfBirth?.toISOString().slice(0, 10) === input.dateOfBirth) return true;
    return false;
  });

  const hits: HitDetail[] = filtered.map((c) => {
    const matchedOn: HitDetail["matchedOn"] = [];
    if (licNorm && c.licenseIdNorm === licNorm) matchedOn.push("license");
    if (nameNorm && (c.fullNameNorm === nameNorm || scoreName(nameNorm, c.fullNameNorm) >= 600)) matchedOn.push("name");
    if (dob && c.dateOfBirth?.toISOString().slice(0, 10) === input.dateOfBirth) matchedOn.push("dob");
    return {
      id: c.id,
      fullName: c.fullName,
      licenseId: c.licenseId,
      licenseState: c.licenseState,
      primaryReason: c.primaryReason,
      severity: c.severity,
      damageAmount: c.damageAmount,
      status: c.status,
      matchedOn,
      thumbnailUrl: c.photos?.[0]?.url ?? null,
      source: c.source ? { id: c.source.id, slug: c.source.slug, name: c.source.name, kind: c.source.kind } : null,
    };
  });

  // Group by source
  const sourceMap = new Map<string, SourceMatchSummary>();
  for (const s of allSources) {
    sourceMap.set(s.id, {
      sourceId: s.id,
      sourceSlug: s.slug,
      sourceName: s.name,
      sourceKind: s.kind,
      sourceTrustScore: s.trustScore,
      hits: 0,
      worstSeverity: null,
      entryIds: [],
    });
  }
  for (const h of hits) {
    if (!h.source) continue;
    const sum = sourceMap.get(h.source.id);
    if (!sum) continue;
    sum.hits++;
    sum.entryIds.push(h.id);
    if (!sum.worstSeverity || SEVERITY_RANK[h.severity] > SEVERITY_RANK[sum.worstSeverity]) {
      sum.worstSeverity = h.severity as any;
    }
  }

  const sources = Array.from(sourceMap.values());
  const matchedSources = sources.filter((s) => s.hits > 0).length;
  const worstSeverity = hits.reduce<HitDetail["severity"] | null>((acc, h) => {
    if (!acc) return h.severity;
    return SEVERITY_RANK[h.severity] > SEVERITY_RANK[acc] ? h.severity : acc;
  }, null);

  // Risk score: weighted by severity, recency, source trust, and confirming-source count.
  let risk = 0;
  for (const h of hits) {
    const sevWeight = SEVERITY_RANK[h.severity] || 1;
    const trust = (h.source ? sourceMap.get(h.source.id)?.sourceTrustScore || 50 : 50) / 100;
    risk += sevWeight * 8 * trust;
  }
  if (matchedSources >= 2) risk += 15; // independent corroboration is bad
  risk = Math.min(100, Math.round(risk));

  const verdict: CrossCheckResult["verdict"] = (() => {
    if (hits.length === 0) return "APPROVE";
    if (worstSeverity === "CRITICAL" || matchedSources >= 2) return "DECLINE";
    if (worstSeverity === "HIGH") return "DECLINE";
    return "REVIEW";
  })();

  return {
    query: input,
    totalSources: allSources.length,
    matchedSources,
    totalHits: hits.length,
    worstSeverity: (worstSeverity as any) ?? null,
    verdict,
    riskScore: risk,
    sources,
    hits,
  };
}
