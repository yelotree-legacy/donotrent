// Minimal CSV parser. Handles RFC 4180 quoted fields, embedded commas,
// embedded newlines inside quotes, and "" escapes. No dependencies.

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[]; error?: string } {
  const lines = splitLogicalLines(text);
  if (lines.length === 0) return { headers: [], rows: [], error: "Empty file" };
  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/[\s\-]+/g, "_"));
  if (headers.length === 0) return { headers: [], rows: [], error: "No header row" };

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const cells = parseLine(raw);
    const row: CsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (cells[j] ?? "").trim();
    }
    rows.push(row);
  }
  return { headers, rows };
}

// Split on newlines outside quoted fields. Handles "" escape inside quotes.
function splitLogicalLines(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { cur += '""'; i++; continue; }
      inQuote = !inQuote;
      cur += ch;
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuote) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; continue; }
      inQuote = !inQuote;
      continue;
    }
    if (ch === "," && !inQuote) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}
