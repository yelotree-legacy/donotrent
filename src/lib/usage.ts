// Usage metering. Single source of truth for "can this company run another check?".

import { prisma } from "./db";
import { checksRemaining, getPlan } from "./plans";

export type UsageCheckResult =
  | { ok: true; remaining: number; isUnlimited: boolean }
  | { ok: false; reason: "no_company"; remaining: 0 }
  | { ok: false; reason: "limit_reached"; remaining: 0; limit: number; plan: string };

/**
 * Returns whether the company can perform another billable action (cross-check,
 * IDV, etc.) based on their current plan + usage.
 */
export async function canConsumeCheck(companyId: string | null | undefined): Promise<UsageCheckResult> {
  if (!companyId) {
    // Anonymous searches don't count; only logged-in companies have quotas.
    return { ok: true, remaining: Infinity, isUnlimited: true };
  }
  const co = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true, checksUsedThisPeriod: true, currentPeriodEnd: true, isAdmin: true },
  });
  if (!co) return { ok: false, reason: "no_company", remaining: 0 };
  if (co.isAdmin) return { ok: true, remaining: Infinity, isUnlimited: true };

  const r = checksRemaining({ plan: co.plan, checksUsedThisPeriod: co.checksUsedThisPeriod });
  if (r.isUnlimited) return { ok: true, remaining: Infinity, isUnlimited: true };
  if (r.remaining <= 0) {
    return { ok: false, reason: "limit_reached", remaining: 0, limit: r.limit, plan: co.plan };
  }
  return { ok: true, remaining: r.remaining, isUnlimited: false };
}

/**
 * Atomically increments the check counter. Call AFTER the check succeeds so
 * we don't bill on errors. Increment is a no-op for admins or unlimited plans.
 */
export async function incrementCheck(companyId: string | null | undefined): Promise<void> {
  if (!companyId) return;
  const co = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true, isAdmin: true },
  });
  if (!co) return;
  if (co.isAdmin) return;
  const plan = getPlan(co.plan);
  if (plan.monthlyChecks === 0 && plan.slug !== "free") return; // unlimited
  await prisma.company.update({
    where: { id: companyId },
    data: { checksUsedThisPeriod: { increment: 1 } },
  });
}
