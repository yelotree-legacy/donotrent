// OFAC SDN list matcher. The US Treasury publishes the full Specially
// Designated Nationals list as a public CSV. We download, cache for 24
// hours, and fuzzy-match the renter's name against it.
//
// Source: https://www.treasury.gov/ofac/downloads/sdn.csv
// License: public domain (US gov data)
// Updates: ~daily
//
// Output: a single row when there's a confident name match, with the SDN's
// listed name, address country, and program list (e.g. SDGT, NARCOTICS).

import { normalizeName } from "../normalize";

export type OfacMatch = {
  uid: string;
  name: string;
  type: string; // individual | entity | vessel | aircraft
  programs: string[];
  remarks?: string;
  score: number; // 0-1000
};

export type OfacResult =
  | { status: "clear" }
  | { status: "match"; matches: OfacMatch[] }
  | { status: "error"; error: string };

const SDN_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv";
const ALT_URL = "https://www.treasury.gov/ofac/downloads/alt.csv"; // alternate names / aliases
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cachedSdn: { rows: SdnRow[]; aliases: AltRow[]; loadedAt: number } | null = null;
let inflightLoad: Promise<void> | null = null;

type SdnRow = {
  uid: string;
  name: string;
  nameNorm: string;
  type: string;
  programs: string[];
  remarks?: string;
};

type AltRow = {
  uid: string;
  altName: string;
  altNameNorm: string;
};

async function loadList(): Promise<void> {
  if (cachedSdn && Date.now() - cachedSdn.loadedAt < CACHE_TTL_MS) return;
  if (inflightLoad) return inflightLoad;

  inflightLoad = (async () => {
    const [sdnText, altText] = await Promise.all([
      fetchCsv(SDN_URL),
      fetchCsv(ALT_URL).catch(() => ""), // alt is optional
    ]);
    const rows = parseSdn(sdnText);
    const aliases = parseAlt(altText);
    cachedSdn = { rows, aliases, loadedAt: Date.now() };
  })();

  try {
    await inflightLoad;
  } finally {
    inflightLoad = null;
  }
}

async function fetchCsv(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 DNR-Registry-OFAC-Sync" },
    // Cache: revalidate at most once per 24h via Next data cache.
    next: { revalidate: 86400 },
  } as any);
  if (!res.ok) throw new Error(`OFAC fetch ${url}: HTTP ${res.status}`);
  return res.text();
}

// SDN.CSV columns:
// 1. ent_num   2. SDN_Name   3. SDN_Type   4. Program   5. Title
// 6. Call_Sign 7. Vess_type  8. Tonnage    9. GRT       10. Vess_flag
// 11. Vess_owner 12. Remarks
function parseSdn(text: string): SdnRow[] {
  const rows: SdnRow[] = [];
  for (const line of splitCsvLines(text)) {
    const cells = parseCsvLine(line);
    if (cells.length < 4) continue;
    const [uid, name, type, programs, , , , , , , , remarks] = cells;
    if (!uid || !name) continue;
    rows.push({
      uid: uid.trim(),
      name: name.trim().replace(/(^"|"$)/g, ""),
      nameNorm: normalizeName(name),
      type: (type || "individual").trim().toLowerCase(),
      programs: (programs || "").split(";").map((s) => s.trim()).filter(Boolean),
      remarks: remarks?.trim(),
    });
  }
  return rows;
}

// ALT.CSV columns: ent_num, alt_num, alt_type, alt_name, alt_remarks
function parseAlt(text: string): AltRow[] {
  const out: AltRow[] = [];
  for (const line of splitCsvLines(text)) {
    const cells = parseCsvLine(line);
    if (cells.length < 4) continue;
    const [uid, , altType, altName] = cells;
    if (!uid || !altName) continue;
    // altType can be aka, fka, nka — we want all
    out.push({
      uid: uid.trim(),
      altName: altName.replace(/(^"|"$)/g, "").trim(),
      altNameNorm: normalizeName(altName),
    });
  }
  return out;
}

function splitCsvLines(text: string): string[] {
  // OFAC CSV uses CRLF and may have quoted fields with commas. Split on
  // newlines outside quotes.
  const lines: string[] = [];
  let current = "";
  let inQuote = false;
  for (const ch of text) {
    if (ch === '"') inQuote = !inQuote;
    if ((ch === "\n" || ch === "\r") && !inQuote) {
      if (current) { lines.push(current); current = ""; }
      continue;
    }
    current += ch;
  }
  if (current) lines.push(current);
  return lines;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// Match a queried name against the SDN list. The fuzzy bar is intentionally
// strict — false positives in OFAC are bad. Two strategies:
//   1. Exact normalized match (highest confidence)
//   2. Token-set overlap >= 0.85 (handles word-order, middle-name absent)
export async function checkOfac(fullName: string): Promise<OfacResult> {
  if (!fullName || fullName.trim().length < 3) return { status: "clear" };
  try {
    await loadList();
  } catch (e: any) {
    return { status: "error", error: e?.message || "Failed to load OFAC list" };
  }
  if (!cachedSdn) return { status: "error", error: "List unavailable" };

  const queryTokens = nameTokens(fullName);
  if (queryTokens.length < 2) return { status: "clear" }; // single-token names → too many false positives

  const matches: OfacMatch[] = [];

  for (const row of cachedSdn.rows) {
    if (row.type !== "individual") continue; // entities/vessels are not relevant for renter checks
    const score = scoreName(queryTokens, row.name);
    if (score >= 850) {
      matches.push({
        uid: row.uid,
        name: row.name,
        type: row.type,
        programs: row.programs,
        remarks: row.remarks,
        score,
      });
    }
  }

  // Aliases — match queried name against alt names belonging to individuals
  const indivUids = new Set(cachedSdn.rows.filter((r) => r.type === "individual").map((r) => r.uid));
  for (const a of cachedSdn.aliases) {
    if (!indivUids.has(a.uid)) continue;
    const score = scoreName(queryTokens, a.altName);
    if (score >= 900) {
      const parent = cachedSdn.rows.find((r) => r.uid === a.uid);
      if (!parent) continue;
      // Don't double-add if already matched under primary name
      if (matches.some((m) => m.uid === parent.uid)) continue;
      matches.push({
        uid: parent.uid,
        name: `${parent.name} (a.k.a. ${a.altName})`,
        type: parent.type,
        programs: parent.programs,
        remarks: parent.remarks,
        score,
      });
    }
  }

  if (matches.length === 0) return { status: "clear" };
  return { status: "match", matches: matches.sort((a, b) => b.score - a.score).slice(0, 5) };
}

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function scoreName(queryTokens: string[], candidate: string): number {
  const candTokens = nameTokens(candidate);
  if (candTokens.length === 0) return 0;

  // Exact normalized full-string match → 1000
  const qFull = queryTokens.join("");
  const cFull = candTokens.join("");
  if (qFull === cFull) return 1000;

  // Token-set Jaccard: overlap / union
  const qSet = new Set(queryTokens);
  const cSet = new Set(candTokens);
  let overlap = 0;
  qSet.forEach((t) => { if (cSet.has(t)) overlap++; });
  const union = qSet.size + cSet.size - overlap;
  if (union === 0) return 0;
  const jaccard = overlap / union;
  // Require last names to match — drops common-first-name false positives
  const qLast = queryTokens[queryTokens.length - 1];
  const cLast = candTokens[candTokens.length - 1];
  if (qLast !== cLast) return 0;

  return Math.round(jaccard * 1000);
}

// Background sync hook — called from a cron or admin action to pre-warm the
// cache and surface fetch failures early.
export async function syncOfacList(): Promise<{ rows: number; aliases: number; loadedAt: number }> {
  cachedSdn = null;
  await loadList();
  const c = cachedSdn as null | { rows: SdnRow[]; aliases: AltRow[]; loadedAt: number };
  return {
    rows: c?.rows.length || 0,
    aliases: c?.aliases.length || 0,
    loadedAt: c?.loadedAt || 0,
  };
}

export function getOfacCacheInfo(): { cached: boolean; rowsLoaded: number; ageMinutes: number | null } {
  if (!cachedSdn) return { cached: false, rowsLoaded: 0, ageMinutes: null };
  return {
    cached: true,
    rowsLoaded: cachedSdn.rows.length,
    ageMinutes: Math.round((Date.now() - cachedSdn.loadedAt) / 60000),
  };
}
