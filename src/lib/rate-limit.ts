// Simple DB-backed rate limiter. Each attempt is a row in RateLimitAttempt.
// Counts rows in a rolling window per key. Cheap enough for our scale.
//
// Two flavors:
//   - rateLimit: fail-open (returns ok=true on DB errors). Use for non-
//     security-critical paths (search, checks) — better to let traffic
//     through than block everything if the limiter itself is down.
//   - rateLimitStrict: fail-closed (returns ok=false on DB errors). Use
//     for security paths (login brute-force).

import { headers } from "next/headers";
import { prisma } from "./db";

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number; limit: number; reason: "limit" | "error" };

export type RateLimitOpts = {
  key: string;        // e.g. "signup:1.2.3.4"
  windowMs: number;   // rolling window length
  limit: number;      // max attempts in window
  metadata?: any;     // optional, stored as JSON
};

/**
 * Fail-open: if the rate-limit query fails for any reason, treat as "ok"
 * so we don't bring the whole site down on a flaky DB.
 */
export async function rateLimit(opts: RateLimitOpts): Promise<RateLimitResult> {
  try {
    return await checkAndRecord(opts);
  } catch (e) {
    console.error("[rateLimit] check failed, allowing through:", e);
    return { ok: true, remaining: opts.limit };
  }
}

/**
 * Fail-closed: if the limiter is down, block. Use for security paths
 * where overcounting is OK but undercounting is unacceptable.
 */
export async function rateLimitStrict(opts: RateLimitOpts): Promise<RateLimitResult> {
  try {
    return await checkAndRecord(opts);
  } catch (e) {
    console.error("[rateLimitStrict] check failed, blocking:", e);
    return { ok: false, retryAfterSeconds: 60, limit: opts.limit, reason: "error" };
  }
}

async function checkAndRecord(opts: RateLimitOpts): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - opts.windowMs);

  const recent = await prisma.rateLimitAttempt.count({
    where: { key: opts.key, createdAt: { gte: windowStart } },
  });

  if (recent >= opts.limit) {
    const oldest = await prisma.rateLimitAttempt.findFirst({
      where: { key: opts.key, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const retryAt = oldest
      ? oldest.createdAt.getTime() + opts.windowMs
      : now.getTime() + opts.windowMs;
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now.getTime()) / 1000)),
      limit: opts.limit,
      reason: "limit",
    };
  }

  await prisma.rateLimitAttempt.create({
    data: { key: opts.key, metadata: opts.metadata ? JSON.stringify(opts.metadata) : null },
  });

  return { ok: true, remaining: Math.max(0, opts.limit - recent - 1) };
}

/**
 * Read the requester IP from the standard headers Vercel sets.
 * Falls back to "unknown" so an anonymous attempt still gets some bucket.
 */
export function getClientIp(): string {
  try {
    const h = headers();
    return (
      h.get("x-real-ip") ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-vercel-forwarded-for") ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

/**
 * Daily cleanup. Hit this from a cron or admin action to prune rows
 * older than 24h (the longest window we use).
 */
export async function purgeOldRateLimits(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.rateLimitAttempt.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}

// Convenience presets so the limit math lives in one place.
export const Limits = {
  // Per-IP signup: prevent bot account-bombing
  signup:        { windowMs: 24 * 60 * 60 * 1000, limit: 5 },
  // Per-email login attempts: brute-force protection
  loginByEmail:  { windowMs: 60 * 60 * 1000,      limit: 10 },
  // Per-IP login attempts (catches credential-stuffing across many emails)
  loginByIp:     { windowMs: 60 * 60 * 1000,      limit: 20 },
  // Anonymous unified search (heavy DB query)
  searchByIp:    { windowMs: 60 * 1000,           limit: 60 },
  // Public API (per API key)
  apiCheckByKey: { windowMs: 60 * 1000,           limit: 60 },
  // Disputes (anyone can file, must throttle spam)
  disputeByIp:   { windowMs: 24 * 60 * 60 * 1000, limit: 5 },
} as const;
