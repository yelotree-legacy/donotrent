// File upload abstraction. Production uses Vercel Blob (writable filesystem
// is not available on Vercel functions). Local dev falls back to writing to
// public/uploads/<subdir>/ when BLOB_READ_WRITE_TOKEN is unset.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function saveUpload(file: File, subdir = "licenses"): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return saveToVercelBlob(file, subdir);
  }
  return saveToLocalFs(file, subdir);
}

async function saveToVercelBlob(file: File, subdir: string): Promise<string> {
  const { put } = await import("@vercel/blob");
  const ext = mimeToExt(file.type);
  const key = `${subdir}/${randomUUID()}.${ext}`;
  const blob = await put(key, file, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false,
  });
  return blob.url;
}

async function saveToLocalFs(file: File, subdir: string): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = mimeToExt(file.type);
  const id = randomUUID();
  const dir = join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });
  const filename = `${id}.${ext}`;
  await writeFile(join(dir, filename), buf);
  return `/uploads/${subdir}/${filename}`;
}

function mimeToExt(mime: string): string {
  return mime === "image/png" ? "png"
    : mime === "image/jpeg" ? "jpg"
      : mime === "image/webp" ? "webp" : "gif";
}
