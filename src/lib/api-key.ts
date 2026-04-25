// API key generation + verification.
// Plaintext format: dnr_live_<24 random base64url chars>
// Storage: SHA-256 hash of plaintext (so leaks of the DB don't leak keys),
// plus a 4-char hint for display (no secret value).

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";

export const KEY_PREFIX = "dnr_live_";
export const KEY_LENGTH = 32; // base64url length we generate

export function generateApiKey(): { plaintext: string; hash: string; hint: string } {
  const random = randomBytes(24).toString("base64url");
  const plaintext = `${KEY_PREFIX}${random}`;
  const hash = hashKey(plaintext);
  const hint = plaintext.slice(-4);
  return { plaintext, hash, hint };
}

export function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export async function verifyApiKey(plaintext: string): Promise<{
  companyId: string;
  plan: string;
  apiKeyHint: string | null;
} | null> {
  if (!plaintext || !plaintext.startsWith(KEY_PREFIX)) return null;
  if (plaintext.length < KEY_PREFIX.length + KEY_LENGTH) return null;
  const hash = hashKey(plaintext);

  const co = await prisma.company.findUnique({
    where: { apiKeyHash: hash },
    select: { id: true, plan: true, apiKeyHint: true, apiKeyHash: true },
  });
  if (!co || !co.apiKeyHash) return null;

  // Defense in depth: timing-safe compare even though Prisma already
  // matched on the unique index.
  const expected = Buffer.from(co.apiKeyHash, "hex");
  const actual = Buffer.from(hash, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  return { companyId: co.id, plan: co.plan, apiKeyHint: co.apiKeyHint };
}

// One-shot: rotate the key on a Company. Returns the plaintext (caller is
// expected to surface it ONCE — we don't store it).
export async function rotateApiKey(companyId: string): Promise<{ plaintext: string; hint: string }> {
  const { plaintext, hash, hint } = generateApiKey();
  await prisma.company.update({
    where: { id: companyId },
    data: { apiKeyHash: hash, apiKeyHint: hint },
  });
  return { plaintext, hint };
}

export async function revokeApiKey(companyId: string): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: { apiKeyHash: null, apiKeyHint: null },
  });
}
