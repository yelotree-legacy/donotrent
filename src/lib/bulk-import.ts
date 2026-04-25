// Validates + persists a batch of DNR entries from CSV. Idempotent on
// (sourceId, fullNameNorm) — re-importing the same row updates the existing
// entry instead of duplicating it.

import { prisma } from "./db";
import { normalizeLicense, normalizeName, splitName } from "./normalize";

const SEVERITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const VALID_HEADERS = new Set([
  "full_name", "license_id", "license_state", "dob",
  "primary_reason", "detailed_notes", "severity",
  "damage_amount", "incident_date", "incident_city", "incident_state",
  "categories", "aliases", "photo_url",
]);

export type RawRow = Record<string, string>;

export type ValidatedRow = {
  rowIndex: number;
  ok: boolean;
  error?: string;
  data?: NormalizedRow;
};

export type NormalizedRow = {
  fullName: string;
  fullNameNorm: string;
  licenseId: string | null;
  licenseIdNorm: string | null;
  licenseState: string | null;
  dateOfBirth: Date | null;
  primaryReason: string;
  detailedNotes: string | null;
  severity: string;
  damageAmount: number | null;
  incidentDate: Date | null;
  incidentCity: string | null;
  incidentState: string | null;
  categories: string[];
  aliases: string[];
  photoUrl: string | null;
};

export function validateRows(rows: RawRow[]): ValidatedRow[] {
  return rows.map((row, idx) => {
    const r: any = { rowIndex: idx + 2 }; // +2 for 1-based header offset

    const fullName = (row.full_name || "").trim();
    if (!fullName) {
      r.ok = false; r.error = "full_name required";
      return r;
    }

    const severity = ((row.severity || "MEDIUM").toUpperCase()).trim();
    if (!SEVERITIES.has(severity)) {
      r.ok = false; r.error = `severity must be one of LOW/MEDIUM/HIGH/CRITICAL (got "${row.severity}")`;
      return r;
    }

    const dob = parseDate(row.dob);
    if (row.dob && !dob) {
      r.ok = false; r.error = `dob: invalid date (use YYYY-MM-DD): "${row.dob}"`;
      return r;
    }

    const damage = row.damage_amount ? Number(row.damage_amount.replace(/[$,]/g, "")) : NaN;
    if (row.damage_amount && Number.isNaN(damage)) {
      r.ok = false; r.error = `damage_amount: invalid number "${row.damage_amount}"`;
      return r;
    }

    const incidentDate = parseDate(row.incident_date);
    if (row.incident_date && !incidentDate) {
      r.ok = false; r.error = `incident_date: invalid date`;
      return r;
    }

    const licenseId = (row.license_id || "").trim() || null;
    const licenseState = ((row.license_state || "").trim().toUpperCase().slice(0, 2)) || null;
    const incidentState = ((row.incident_state || "").trim().toUpperCase().slice(0, 2)) || null;

    const categories = (row.categories || "")
      .split(/[;|,]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const aliases = (row.aliases || "")
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const photoUrl = (row.photo_url || "").trim() || null;
    if (photoUrl && !/^https?:\/\//.test(photoUrl) && !photoUrl.startsWith("/")) {
      r.ok = false; r.error = "photo_url must be http(s):// or absolute /path";
      return r;
    }

    r.ok = true;
    r.data = {
      fullName,
      fullNameNorm: normalizeName(fullName),
      licenseId,
      licenseIdNorm: licenseId ? normalizeLicense(licenseId) : null,
      licenseState,
      dateOfBirth: dob,
      primaryReason: (row.primary_reason || "").trim() || "Imported entry",
      detailedNotes: (row.detailed_notes || "").trim() || null,
      severity,
      damageAmount: !Number.isNaN(damage) ? damage : null,
      incidentDate,
      incidentCity: (row.incident_city || "").trim() || null,
      incidentState,
      categories,
      aliases,
      photoUrl,
    };
    return r;
  });
}

export function unknownHeaders(headers: string[]): string[] {
  return headers.filter((h) => h && !VALID_HEADERS.has(h));
}

export async function commitBulkImport(opts: {
  sourceId: string;
  createdById?: string | null;
  rows: NormalizedRow[];
}): Promise<{ created: number; updated: number; failed: number; errors: string[] }> {
  const cats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));

  let created = 0, updated = 0, failed = 0;
  const errors: string[] = [];

  for (const r of opts.rows) {
    try {
      const parts = splitName(r.fullName);
      const aliasJson = r.aliases.length ? JSON.stringify(r.aliases) : null;

      const existing = await prisma.dnrEntry.findFirst({
        where: { sourceId: opts.sourceId, fullNameNorm: r.fullNameNorm },
        select: { id: true },
      });

      const baseData = {
        fullName: r.fullName,
        fullNameNorm: r.fullNameNorm,
        firstName: parts.first,
        middleName: parts.middle,
        lastName: parts.last,
        aliases: aliasJson,
        licenseId: r.licenseId,
        licenseIdNorm: r.licenseIdNorm,
        licenseState: r.licenseState,
        dateOfBirth: r.dateOfBirth,
        primaryReason: r.primaryReason,
        detailedNotes: r.detailedNotes,
        severity: r.severity,
        damageAmount: r.damageAmount,
        incidentDate: r.incidentDate,
        incidentCity: r.incidentCity,
        incidentState: r.incidentState,
        sourceId: opts.sourceId,
        createdById: opts.createdById ?? null,
        status: "ACTIVE",
      };

      let entryId: string;
      if (existing) {
        await prisma.dnrEntry.update({ where: { id: existing.id }, data: baseData });
        entryId = existing.id;
        updated++;
      } else {
        const ent = await prisma.dnrEntry.create({
          data: { ...baseData, reasons: { create: [{ text: r.primaryReason, amount: r.damageAmount }] } },
        });
        entryId = ent.id;
        created++;
      }

      // Link categories
      if (r.categories.length) {
        await prisma.entryCategory.deleteMany({ where: { entryId } });
        for (const slug of r.categories) {
          const id = catBySlug.get(slug);
          if (id) {
            await prisma.entryCategory.create({ data: { entryId, categoryId: id } });
          }
        }
      }

      // Attach photo (only if not already there)
      if (r.photoUrl) {
        const dup = await prisma.photo.findFirst({ where: { entryId, url: r.photoUrl }, select: { id: true } });
        if (!dup) {
          await prisma.photo.create({
            data: { entryId, url: r.photoUrl, kind: "LICENSE_FRONT" },
          });
        }
      }
    } catch (e: any) {
      failed++;
      errors.push(`${r.fullName}: ${e?.message || e}`);
    }
  }

  return { created, updated, failed, errors };
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  // Accept YYYY-MM-DD or MM/DD/YYYY
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    const d = new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
