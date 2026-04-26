import { prisma } from "./db";
import { normalizeLicense, normalizeName, scoreName } from "./normalize";

export type SearchField = "any" | "name" | "license";

export type SearchOptions = {
  query: string;
  field?: SearchField;
  categories?: string[]; // category slugs
  severity?: string[]; // LOW | MEDIUM | HIGH | CRITICAL
  status?: string[]; // ACTIVE | ARCHIVED | REFORMED | DISPUTED
  state?: string;
  limit?: number;
  offset?: number;
};

export type SearchHit = {
  id: string;
  fullName: string;
  licenseId: string | null;
  licenseState: string | null;
  primaryReason: string;
  severity: string;
  status: string;
  damageAmount: number | null;
  matchKind: "exact_license" | "exact_name" | "prefix" | "substring" | "fuzzy" | "alias" | "category";
  score: number;
  categories: string[];
  thumbnailUrl: string | null;
  createdById: string | null;
  createdAt: Date;
};

const ALL_LIMIT = 200;

const HIT_INCLUDE = {
  categories: { include: { category: true } },
  photos: { take: 1, orderBy: { createdAt: "asc" as const } },
};

/**
 * If the operator typed both a name AND a license id in the same field
 * (e.g. "Tyler Treasure F5362380"), split them. We then run the search
 * twice — once with each part — and merge results. This way a fake
 * license still surfaces a name match, instead of trying to match the
 * whole string and finding nothing.
 *
 * Returns null when there's only one logical token; the caller falls
 * back to the normal single-field flow.
 */
function splitNameAndLicense(query: string): { name: string; license: string } | null {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const licenseTokens: string[] = [];
  const nameTokens: string[] = [];

  for (const t of tokens) {
    const stripped = t.replace(/-/g, "");
    const hasDigit = /\d/.test(stripped);
    const isAlphaNum = /^[A-Za-z0-9]+$/.test(stripped);
    const digitCount = (stripped.match(/\d/g) || []).length;

    // License-like: ≥5 chars, alphanumeric only, ≥4 digits
    if (hasDigit && isAlphaNum && stripped.length >= 5 && digitCount >= 4) {
      licenseTokens.push(t);
    } else if (/^[A-Za-z][A-Za-z'.-]{0,30}$/.test(t) || /^(II|III|IV|JR|SR)$/i.test(t)) {
      nameTokens.push(t);
    } else {
      // Ambiguous — bias toward name (safer to over-search names than under-search)
      nameTokens.push(t);
    }
  }

  if (licenseTokens.length === 0 || nameTokens.length === 0) return null;
  return { name: nameTokens.join(" "), license: licenseTokens[0] };
}

/**
 * Multi-strategy search:
 *  1. If query looks like a license id (>= 5 chars, mostly alphanumeric) try exact license match first.
 *  2. Exact normalized name match.
 *  3. Prefix on normalized name (LIKE 'q%').
 *  4. Substring on normalized name (LIKE '%q%').
 *  5. Search in primary reason text + aliases (LIKE %q% case-insensitive).
 *  6. Fuzzy (Levenshtein) over remaining candidates — bounded to top ALL_LIMIT.
 *
 * If field === "any" and the query mixes name + license tokens, we recursively
 * search each separately and merge — so a fake license number doesn't hide a
 * legitimate name match.
 *
 * Filters (categories, severity, status, state) intersect with the matched set.
 */
export async function searchEntries(opts: SearchOptions): Promise<{ hits: SearchHit[]; total: number }> {
  const q = opts.query.trim();
  const field = opts.field ?? "any";
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  if (!q) {
    return browse(opts, limit, offset);
  }

  // Smart split: if the query mixes a name and a license id, fan out and merge.
  if (field === "any") {
    const split = splitNameAndLicense(q);
    if (split) {
      const [byLicense, byName] = await Promise.all([
        searchEntries({ ...opts, query: split.license, field: "license", limit }),
        searchEntries({ ...opts, query: split.name, field: "name", limit }),
      ]);
      const merged = new Map<string, SearchHit>();
      // License matches first — they're higher signal when they match.
      for (const h of byLicense.hits) merged.set(h.id, h);
      for (const h of byName.hits) {
        const existing = merged.get(h.id);
        if (!existing || h.score > existing.score) merged.set(h.id, h);
      }
      const all = Array.from(merged.values()).sort((a, b) => b.score - a.score);
      return { hits: all.slice(offset, offset + limit), total: all.length };
    }
  }

  const qNameNorm = normalizeName(q);
  const qLicNorm = normalizeLicense(q);
  const looksLikeLicense = qLicNorm.length >= 5 && /[A-Z]/.test(qLicNorm) && /[0-9]/.test(qLicNorm);

  const baseFilter: any = {};
  if (opts.categories?.length) {
    baseFilter.categories = { some: { category: { slug: { in: opts.categories } } } };
  }
  if (opts.severity?.length) baseFilter.severity = { in: opts.severity };
  if (opts.status?.length) baseFilter.status = { in: opts.status };
  if (opts.state) baseFilter.licenseState = opts.state.toUpperCase();

  const seen = new Map<string, SearchHit>();
  const push = (rows: any[], matchKind: SearchHit["matchKind"], scoreFor: (r: any) => number) => {
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.set(r.id, mapRow(r, matchKind, scoreFor(r)));
    }
  };

  // Strategy 1: exact license id
  if ((field === "any" || field === "license") && qLicNorm.length >= 4) {
    const rows = await prisma.dnrEntry.findMany({
      where: { ...baseFilter, licenseIdNorm: qLicNorm },
      include: HIT_INCLUDE,
      take: limit,
    });
    push(rows, "exact_license", () => 2000);
  }

  // Strategy 2: exact normalized name
  if ((field === "any" || field === "name") && qNameNorm.length >= 2) {
    const rows = await prisma.dnrEntry.findMany({
      where: { ...baseFilter, fullNameNorm: qNameNorm },
      include: HIT_INCLUDE,
      take: limit,
    });
    push(rows, "exact_name", () => 1500);
  }

  // Strategy 3: prefix on normalized name
  if ((field === "any" || field === "name") && qNameNorm.length >= 2) {
    const rows = await prisma.dnrEntry.findMany({
      where: { ...baseFilter, fullNameNorm: { startsWith: qNameNorm } },
      include: HIT_INCLUDE,
      take: limit,
    });
    push(rows, "prefix", (r) => scoreName(qNameNorm, r.fullNameNorm));
  }

  // Strategy 4: substring on normalized name
  if ((field === "any" || field === "name") && qNameNorm.length >= 2) {
    const rows = await prisma.dnrEntry.findMany({
      where: { ...baseFilter, fullNameNorm: { contains: qNameNorm } },
      include: HIT_INCLUDE,
      take: limit * 2,
    });
    push(rows, "substring", (r) => scoreName(qNameNorm, r.fullNameNorm));
  }

  // Strategy 5: aliases / reason text (case-insensitive contains).
  // SQLite default collation is binary so we lowercase the input and search aliases manually.
  if (field === "any" && q.length >= 3) {
    const ql = q.toLowerCase();
    const rows = await prisma.dnrEntry.findMany({
      where: {
        ...baseFilter,
        OR: [
          { aliases: { contains: q } },
          { aliases: { contains: ql } },
          { primaryReason: { contains: q } },
          { primaryReason: { contains: ql } },
        ],
      },
      include: HIT_INCLUDE,
      take: limit,
    });
    push(rows, "alias", (r) => {
      if (r.aliases?.toLowerCase().includes(ql)) return 700;
      return 300;
    });
  }

  // Strategy 6: fuzzy. Pull a wide candidate set (lastName same first letter) and rank by Levenshtein.
  if ((field === "any" || field === "name") && qNameNorm.length >= 3 && seen.size < limit) {
    const initial = qNameNorm[0];
    const candidates = await prisma.dnrEntry.findMany({
      where: { ...baseFilter, fullNameNorm: { startsWith: initial } },
      include: HIT_INCLUDE,
      take: ALL_LIMIT,
    });
    const fuzzyHits = candidates
      .map((r) => ({ row: r, score: scoreName(qNameNorm, r.fullNameNorm) }))
      .filter((x) => x.score > 0);
    push(fuzzyHits.map((x) => x.row), "fuzzy", (r) => {
      const c = fuzzyHits.find((x) => x.row.id === r.id);
      return c?.score ?? 100;
    });
  }

  const all = Array.from(seen.values()).sort((a, b) => b.score - a.score);
  return { hits: all.slice(offset, offset + limit), total: all.length };
}

async function browse(opts: SearchOptions, limit: number, offset: number) {
  const where: any = {};
  if (opts.categories?.length) {
    where.categories = { some: { category: { slug: { in: opts.categories } } } };
  }
  if (opts.severity?.length) where.severity = { in: opts.severity };
  if (opts.status?.length) where.status = { in: opts.status };
  if (opts.state) where.licenseState = opts.state.toUpperCase();

  const [rows, total] = await Promise.all([
    prisma.dnrEntry.findMany({
      where,
      include: HIT_INCLUDE,
      orderBy: [{ severity: "desc" }, { fullName: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.dnrEntry.count({ where }),
  ]);
  return {
    hits: rows.map((r) => mapRow(r, "substring", 100)),
    total,
  };
}

function mapRow(r: any, matchKind: SearchHit["matchKind"], score: number): SearchHit {
  return {
    id: r.id,
    fullName: r.fullName,
    licenseId: r.licenseId,
    licenseState: r.licenseState,
    primaryReason: r.primaryReason,
    severity: r.severity,
    status: r.status,
    damageAmount: r.damageAmount,
    thumbnailUrl: r.photos?.[0]?.url ?? null,
    matchKind,
    score,
    categories: (r.categories || []).map((ec: any) => ec.category?.slug).filter(Boolean),
    createdById: r.createdById,
    createdAt: r.createdAt,
  };
}
