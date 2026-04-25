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
  createdById: string | null;
  createdAt: Date;
};

const ALL_LIMIT = 200;

/**
 * Multi-strategy search:
 *  1. If query looks like a license id (>= 5 chars, mostly alphanumeric) try exact license match first.
 *  2. Exact normalized name match.
 *  3. Prefix on normalized name (LIKE 'q%').
 *  4. Substring on normalized name (LIKE '%q%').
 *  5. Search in primary reason text + aliases (LIKE %q% case-insensitive).
 *  6. Fuzzy (Levenshtein) over remaining candidates — bounded to top ALL_LIMIT.
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
      include: { categories: { include: { category: true } } },
      take: limit,
    });
    push(rows, "exact_license", () => 2000);
  }

  // Strategy 2: exact normalized name
  if ((field === "any" || field === "name") && qNameNorm.length >= 2) {
    const rows = await prisma.dnrEntry.findMany({
      where: { ...baseFilter, fullNameNorm: qNameNorm },
      include: { categories: { include: { category: true } } },
      take: limit,
    });
    push(rows, "exact_name", () => 1500);
  }

  // Strategy 3: prefix on normalized name
  if ((field === "any" || field === "name") && qNameNorm.length >= 2) {
    const rows = await prisma.dnrEntry.findMany({
      where: { ...baseFilter, fullNameNorm: { startsWith: qNameNorm } },
      include: { categories: { include: { category: true } } },
      take: limit,
    });
    push(rows, "prefix", (r) => scoreName(qNameNorm, r.fullNameNorm));
  }

  // Strategy 4: substring on normalized name
  if ((field === "any" || field === "name") && qNameNorm.length >= 2) {
    const rows = await prisma.dnrEntry.findMany({
      where: { ...baseFilter, fullNameNorm: { contains: qNameNorm } },
      include: { categories: { include: { category: true } } },
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
      include: { categories: { include: { category: true } } },
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
      include: { categories: { include: { category: true } } },
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
      include: { categories: { include: { category: true } } },
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
    matchKind,
    score,
    categories: (r.categories || []).map((ec: any) => ec.category?.slug).filter(Boolean),
    createdById: r.createdById,
    createdAt: r.createdAt,
  };
}
