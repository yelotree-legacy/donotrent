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
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? "png"
    : file.type === "image/jpeg" ? "jpg"
      : file.type === "image/webp" ? "webp" : "gif";
  const id = randomUUID();
  const dir = join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });
  const filename = `${id}.${ext}`;
  await writeFile(join(dir, filename), buf);
  return `/uploads/${subdir}/${filename}`;
}
