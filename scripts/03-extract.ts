// Parse the OCR text files into structured license fields. Writes scripts/out/extracted.json.
// Heuristics tuned for noisy Tesseract output of US driver licenses.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

type Enriched = { name: string; reason: string; imageUrl: string; localPath: string; bytes: number };
type Extracted = Enriched & {
  ocrText: string;
  licenseId: string | null;
  licenseState: string | null;
  dob: string | null;
  expiry: string | null;
  issued: string | null;
  sex: string | null;
  height: string | null;
  weight: string | null;
  eyes: string | null;
  hair: string | null;
  licenseClass: string | null;
  address: string | null;
  ocrConfidence: "high" | "medium" | "low" | "empty";
};

const STATE_NAMES: Record<string, string> = {
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA",
  COLORADO: "CO", CONNECTICUT: "CT", DELAWARE: "DE", FLORIDA: "FL", GEORGIA: "GA",
  HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL", INDIANA: "IN", IOWA: "IA",
  KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA", MAINE: "ME", MARYLAND: "MD",
  MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN", MISSISSIPPI: "MS", MISSOURI: "MO",
  MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV", "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM", "NEW YORK": "NY", "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND",
  OHIO: "OH", OKLAHOMA: "OK", OREGON: "OR", PENNSYLVANIA: "PA", "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD", TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT",
  VERMONT: "VT", VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV", WISCONSIN: "WI",
  WYOMING: "WY", "DISTRICT OF COLUMBIA": "DC",
};

// Per-state license-number shape. The list is OCR-tolerant — we accept ranges
// because Tesseract often inserts/drops a character.
const STATE_PATTERNS: Record<string, RegExp[]> = {
  FL: [/\b[A-Z]\d{3}-?\d{3}-?\d{2}-?\d{3}-?\d\b/, /\b[A-Z]\d{12}\b/],
  GA: [/\b\d{9}\b/],
  TX: [/\b\d{8}\b/],
  CA: [/\b[A-Z]\d{7}\b/],
  NY: [/\b\d{9}\b/, /\b\d{3}\s?\d{3}\s?\d{3}\b/],
  NJ: [/\b[A-Z]\d{4}\s?\d{5}\s?\d{5}\b/, /\b[A-Z]\d{14}\b/],
  IL: [/\b[A-Z]\d{11,12}\b/],
  PA: [/\b\d{8}\b/],
  OH: [/\b[A-Z]{2}\d{6}\b/],
  MI: [/\b[A-Z]\d{12}\b/],
  MA: [/\bS\d{8}\b/, /\b[A-Z]\d{8}\b/],
  NC: [/\b\d{8,12}\b/],
  VA: [/\b[A-Z]\d{8}\b/, /\b\d{9}\b/],
  MD: [/\b[A-Z]-?\d{3}-?\d{3}-?\d{3}-?\d{3}\b/],
  AL: [/\b\d{7,8}\b/],
  AZ: [/\b[A-Z]\d{8}\b/],
  CO: [/\b\d{2,9}\b/],
  IN: [/\b\d{4}-?\d{2}-?\d{4}\b/, /\b\d{10}\b/],
  TN: [/\b\d{7,9}\b/],
  WA: [/\b[A-Z]{1,7}[A-Z0-9*]{4,11}\b/],
};

function dateRe() {
  return /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g;
}

function findState(text: string): string | null {
  const upper = text.toUpperCase();
  // Look for full names first (highest signal)
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (upper.includes(name)) return code;
  }
  // Fallback: lone two-letter abbreviation followed by zip-like 5 digits
  const m = upper.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
  if (m && Object.values(STATE_NAMES).includes(m[1])) return m[1];
  return null;
}

function findLicenseId(text: string, state: string | null): string | null {
  // 1. Try labeled lines (highest signal): "DLN 1234567" / "DL: A123-..." / "License No: ..."
  const labeled = text.match(/(?:DLN|D\.?L\.?N|DL[#:]|LIC[#:]|LICENSE\s*(?:NO|NUMBER|#))[:.\s]*([A-Z0-9][A-Z0-9 \-]{5,25})/i);
  if (labeled) {
    const cleaned = labeled[1].replace(/\s+/g, "").replace(/^[\-:.]+|[\-:.]+$/g, "").toUpperCase();
    if (looksValid(cleaned)) return cleaned;
  }

  // 2. State-specific patterns
  if (state && STATE_PATTERNS[state]) {
    for (const re of STATE_PATTERNS[state]) {
      const m = text.toUpperCase().match(re);
      if (m) return m[0].replace(/\s+/g, "").toUpperCase();
    }
  }

  // 3. Any token of length 7-15 mixing letters & digits OR all digits 8-12
  const candidates: string[] = [];
  const upper = text.toUpperCase();
  for (const m of upper.matchAll(/\b([A-Z]?\d[A-Z0-9\-]{6,16})\b/g)) {
    const t = m[1].replace(/\-/g, "");
    if (t.length < 7 || t.length > 15) continue;
    if (/^\d+$/.test(t) && t.length < 8) continue; // too short for an all-digit license
    if (/^(19|20)\d{2}$/.test(t)) continue; // year
    if (looksValid(t)) candidates.push(m[1]);
  }
  if (candidates.length) {
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0].replace(/\s+/g, "").toUpperCase();
  }
  return null;
}

function looksValid(t: string): boolean {
  const stripped = t.replace(/[\-\s]/g, "");
  if (stripped.length < 7 || stripped.length > 16) return false;
  if (/^[A-Z]+$/.test(stripped)) return false; // all letters → not a license
  if (/^0+$/.test(stripped)) return false;
  // Require at least 4 digits — kills word-like tokens (e.g. "2JORDAN")
  const digitCount = (stripped.match(/\d/g) || []).length;
  if (digitCount < 4) return false;
  // Letter run can't dominate the string
  const longestLetterRun = (stripped.match(/[A-Z]+/g) || []).reduce((m, x) => Math.max(m, x.length), 0);
  if (longestLetterRun > 5) return false;
  return true;
}

function findField(text: string, label: RegExp): string | null {
  const m = text.match(label);
  return m ? m[1].trim() : null;
}

function parseDates(text: string): { dob: string | null; expiry: string | null; issued: string | null } {
  const dates: { date: Date; raw: string; ctx: string; idx: number }[] = [];
  const lower = text.toLowerCase();
  for (const m of text.matchAll(dateRe())) {
    let [_, mo, da, yr] = m as any;
    mo = parseInt(mo, 10); da = parseInt(da, 10);
    let y = parseInt(yr, 10);
    if (yr.length === 2) y = y < 50 ? 2000 + y : 1900 + y;
    if (mo < 1 || mo > 12 || da < 1 || da > 31 || y < 1900 || y > 2100) continue;
    const ctx = lower.slice(Math.max(0, m.index! - 12), m.index! + (m[0].length) + 12);
    dates.push({ date: new Date(y, mo - 1, da), raw: m[0], ctx, idx: m.index! });
  }
  if (dates.length === 0) return { dob: null, expiry: null, issued: null };

  // Try to label by context
  let dob: string | null = null, expiry: string | null = null, issued: string | null = null;
  for (const d of dates) {
    if (!dob && /(dob|birth|born)/i.test(d.ctx)) dob = isoOrNull(d.date);
    if (!expiry && /(exp|expires|valid until|valid thru)/i.test(d.ctx)) expiry = isoOrNull(d.date);
    if (!issued && /(iss|issued)/i.test(d.ctx)) issued = isoOrNull(d.date);
  }

  // Heuristics if no labels matched:
  // - DOB is the date in the past most likely indicating an adult (1900-2010)
  // - Expiry is the latest date in the future
  if (!dob) {
    const now = Date.now();
    const past = dates.filter((d) => d.date.getFullYear() >= 1900 && d.date.getFullYear() <= 2010 && d.date.getTime() < now);
    if (past.length) dob = isoOrNull(past[0].date);
  }
  if (!expiry) {
    const future = dates.filter((d) => d.date.getTime() > Date.now()).sort((a, b) => b.date.getTime() - a.date.getTime());
    if (future.length) expiry = isoOrNull(future[0].date);
  }
  return { dob, expiry, issued };
}

function isoOrNull(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function classify(text: string): Extracted["ocrConfidence"] {
  if (!text || text.replace(/\s+/g, "").length < 10) return "empty";
  // Strong markers indicate good OCR
  const markers = ["DRIVER", "LICENSE", "DOB", "DL", "CLASS", "EXP", "EYES", "SEX"];
  const hits = markers.filter((m) => text.toUpperCase().includes(m)).length;
  if (hits >= 4) return "high";
  if (hits >= 2) return "medium";
  return "low";
}

const downloads: Enriched[] = JSON.parse(
  readFileSync(join(process.cwd(), "scripts", "out", "downloads.json"), "utf8")
);

const ocrDir = join(process.cwd(), "scripts", "out", "ocr");
const out: Extracted[] = [];

for (const d of downloads) {
  if (!d.localPath) continue;
  const filename = basename(d.localPath);
  const txtPath = join(ocrDir, `${filename}.txt`);
  const text = existsSync(txtPath) ? readFileSync(txtPath, "utf8") : "";

  const state = findState(text);
  const licenseId = findLicenseId(text, state);
  const dates = parseDates(text);
  const sex = findField(text, /\bSEX[:\s]+([MF])/i);
  const height = findField(text, /\bHGT[:\s]+([0-9'"\s\-\.]{2,8})/i);
  const weight = findField(text, /\bWGT[:\s]+([\d]{2,3})/i);
  const eyes = findField(text, /\bEYES[:\s]+([A-Z]{3})/i);
  const hair = findField(text, /\bHAIR[:\s]+([A-Z]{3})/i);
  const klass = findField(text, /\bCLASS[:\s]+([A-Z0-9]{1,3})/i);

  // Address: any line that contains a digit followed by a street word and a state/zip
  let address: string | null = null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 1; i++) {
    if (/\d+\s+[A-Z0-9 .,#]+(ST|RD|AVE|BLVD|DR|LN|CT|HWY|WAY|PL|TER|PKY|TRL)\b/i.test(lines[i])) {
      const next = lines[i + 1] || "";
      address = `${lines[i]} ${next}`.replace(/\s+/g, " ").trim();
      break;
    }
  }

  out.push({
    ...d,
    ocrText: text,
    licenseId,
    licenseState: state,
    dob: dates.dob,
    expiry: dates.expiry,
    issued: dates.issued,
    sex,
    height,
    weight,
    eyes,
    hair,
    licenseClass: klass,
    address,
    ocrConfidence: classify(text),
  });
}

writeFileSync(
  join(process.cwd(), "scripts", "out", "extracted.json"),
  JSON.stringify(out.map((x) => ({ ...x, ocrText: undefined })), null, 2)
);
writeFileSync(
  join(process.cwd(), "scripts", "out", "extracted-with-ocr.json"),
  JSON.stringify(out, null, 2)
);

const stats = {
  total: out.length,
  withLicense: out.filter((x) => x.licenseId).length,
  withState: out.filter((x) => x.licenseState).length,
  withDob: out.filter((x) => x.dob).length,
  withExpiry: out.filter((x) => x.expiry).length,
  withAddress: out.filter((x) => x.address).length,
  high: out.filter((x) => x.ocrConfidence === "high").length,
  medium: out.filter((x) => x.ocrConfidence === "medium").length,
  low: out.filter((x) => x.ocrConfidence === "low").length,
  empty: out.filter((x) => x.ocrConfidence === "empty").length,
};
console.log("✓ extracted.json written");
console.log(stats);
