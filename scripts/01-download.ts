// Download all license images referenced in scripts/out/scrape.json into
// public/uploads/imported/<slug>.<ext>. Idempotent — skips existing files.

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { createHash } from "node:crypto";

type Tuple = { name: string; reason: string; imageUrl: string };

const tuples: Tuple[] = JSON.parse(
  readFileSync(join(process.cwd(), "scripts", "out", "scrape.json"), "utf8")
);

const dir = join(process.cwd(), "public", "uploads", "imported");
mkdirSync(dir, { recursive: true });

const concurrency = 8;

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function localFilename(t: Tuple): string {
  // Build a stable filename: slug + first 8 chars of url-hash + extension
  const ext = extname(new URL(t.imageUrl).pathname).toLowerCase() || ".png";
  const hash = createHash("sha1").update(t.imageUrl).digest("hex").slice(0, 8);
  return `${slugify(t.name)}-${hash}${ext}`;
}

async function downloadOne(t: Tuple): Promise<{ ok: boolean; path: string; bytes: number; error?: string }> {
  const filename = localFilename(t);
  const path = join(dir, filename);
  const relPath = `/uploads/imported/${filename}`;

  if (existsSync(path) && statSync(path).size > 0) {
    return { ok: true, path: relPath, bytes: statSync(path).size };
  }
  try {
    const res = await fetch(t.imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 DNR-Importer",
        "Accept": "image/*",
      },
    });
    if (!res.ok) return { ok: false, path: relPath, bytes: 0, error: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(path, buf);
    return { ok: true, path: relPath, bytes: buf.length };
  } catch (e: any) {
    return { ok: false, path: relPath, bytes: 0, error: e?.message || String(e) };
  }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

(async () => {
  console.log(`→ downloading ${tuples.length} images (concurrency ${concurrency})…`);
  let ok = 0, skipped = 0, failed = 0;
  const enriched: (Tuple & { localPath: string; bytes: number; error?: string })[] = [];

  await pool(tuples.map((t, i) => ({ t, i })), concurrency, async ({ t, i }) => {
    const r = await downloadOne(t);
    if (r.ok) {
      if (r.bytes > 0 && existsSync(join(dir, localFilename(t)))) ok++;
      else skipped++;
    } else failed++;
    if ((ok + skipped + failed) % 25 === 0) {
      console.log(`  …${ok + skipped + failed}/${tuples.length} (ok ${ok}, fail ${failed})`);
    }
    enriched[i] = { ...t, localPath: r.path, bytes: r.bytes, error: r.error };
  });

  writeFileSync(
    join(process.cwd(), "scripts", "out", "downloads.json"),
    JSON.stringify(enriched, null, 2)
  );
  console.log(`✓ ${ok} downloaded, ${failed} failed`);
})();
