// Search normalization helpers shared by seed + runtime search.

export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeLicense(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function splitName(full: string): { first?: string; middle?: string; last?: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { first: parts[0] };
  if (parts.length === 2) return { first: parts[0], last: parts[1] };
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(" "),
    last: parts[parts.length - 1],
  };
}

// Levenshtein distance — used for fuzzy name matching when exact LIKE misses.
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

// Score a candidate name against a query — higher is better.
// Combines exact-substring weight + inverse Levenshtein distance.
export function scoreName(query: string, candidate: string): number {
  const q = normalizeName(query);
  const c = normalizeName(candidate);
  if (!q) return 0;
  if (c === q) return 1000;
  if (c.startsWith(q)) return 800 - (c.length - q.length);
  if (c.includes(q)) return 600;
  const d = levenshtein(q, c);
  if (d > 4) return 0;
  return 400 - d * 80;
}
