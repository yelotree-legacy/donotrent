// Migrate Photo.url values from external CDNs (e.g. supremesportrental.com)
// onto our own Vercel Blob storage so the registry is self-hosted and not
// dependent on third-party CDNs.

import { prisma } from "./db";

const BLOB_HOST = "blob.vercel-storage.com";

/**
 * Find the Vercel Blob read/write token regardless of what Vercel named the
 * env var. The default is BLOB_READ_WRITE_TOKEN, but if you have multiple
 * blob stores or connect via specific flows, Vercel may suffix the store
 * name (e.g. `donotrent_BLOB_READ_WRITE_TOKEN`). Scan for any match.
 */
export function findBlobToken(): { token: string | null; name: string | null } {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return { token: process.env.BLOB_READ_WRITE_TOKEN, name: "BLOB_READ_WRITE_TOKEN" };
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (k.endsWith("BLOB_READ_WRITE_TOKEN") && v) return { token: v, name: k };
  }
  return { token: null, name: null };
}

export function listBlobEnvNames(): string[] {
  return Object.keys(process.env).filter((k) => k.includes("BLOB") || k.includes("VERCEL_BLOB"));
}

function isAlreadyOnBlob(url: string): boolean {
  return url.includes(BLOB_HOST);
}

function isMigratable(url: string): boolean {
  // Skip already-migrated, local /uploads/ paths, and data: URIs
  if (!url) return false;
  if (isAlreadyOnBlob(url)) return false;
  if (url.startsWith("/uploads/")) return false;
  if (url.startsWith("data:")) return false;
  return true;
}

export async function getMigrationStatus() {
  const [total, onBlob] = await Promise.all([
    prisma.photo.count(),
    prisma.photo.count({ where: { url: { contains: BLOB_HOST } } }),
  ]);
  // External = total minus blob — but excludes any odd local paths.
  const remaining = total - onBlob;
  return { total, onBlob, remaining };
}

export async function migrateOnePhoto(photoId: string): Promise<{
  ok: boolean;
  alreadyMigrated?: boolean;
  url?: string;
  error?: string;
}> {
  const { token } = findBlobToken();
  if (!token) {
    return { ok: false, error: "Blob token not found in env" };
  }

  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) return { ok: false, error: "Photo not found" };
  if (isAlreadyOnBlob(photo.url)) return { ok: true, alreadyMigrated: true, url: photo.url };
  if (!isMigratable(photo.url)) return { ok: false, error: "URL not migratable" };

  let buffer: Buffer;
  let contentType = "image/png";
  try {
    const res = await fetch(photo.url, {
      headers: { "User-Agent": "Mozilla/5.0 DNR-Migrator", Accept: "image/*" },
    });
    if (!res.ok) return { ok: false, error: `fetch ${photo.url}: HTTP ${res.status}` };
    contentType = res.headers.get("content-type") || guessContentType(photo.url);
    buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) return { ok: false, error: "empty body" };
  } catch (e: any) {
    return { ok: false, error: `fetch failed: ${e?.message || e}` };
  }

  let blobUrl: string;
  try {
    const { put } = await import("@vercel/blob");
    const ext = extForContentType(contentType);
    const key = `imported/${photo.id}.${ext}`;
    const blob = await put(key, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      token, // pass explicitly in case the SDK can't auto-detect
    } as any);
    blobUrl = blob.url;
  } catch (e: any) {
    return { ok: false, error: `blob upload failed: ${e?.message || e}` };
  }

  await prisma.photo.update({
    where: { id: photoId },
    data: { url: blobUrl },
  });

  return { ok: true, url: blobUrl };
}

export async function migrateBatch(opts: { batchSize?: number; concurrency?: number } = {}): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  errors: { id: string; error: string }[];
}> {
  const batchSize = Math.min(50, Math.max(1, opts.batchSize ?? 20));
  const concurrency = Math.min(8, Math.max(1, opts.concurrency ?? 4));

  const photos = await prisma.photo.findMany({
    where: { url: { not: { contains: BLOB_HOST } } },
    take: batchSize,
    select: { id: true, url: true },
  });

  let succeeded = 0, failed = 0;
  const errors: { id: string; error: string }[] = [];

  // Hand-rolled concurrency limiter
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < photos.length) {
        const idx = i++;
        const p = photos[idx];
        const r = await migrateOnePhoto(p.id);
        if (r.ok) succeeded++;
        else { failed++; errors.push({ id: p.id, error: r.error || "unknown" }); }
      }
    })
  );

  const remaining = await prisma.photo.count({
    where: { url: { not: { contains: BLOB_HOST } } },
  });

  return { processed: photos.length, succeeded, failed, remaining, errors };
}

function extForContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

function guessContentType(url: string): string {
  if (url.toLowerCase().endsWith(".png")) return "image/png";
  if (url.toLowerCase().endsWith(".webp")) return "image/webp";
  if (url.toLowerCase().endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
