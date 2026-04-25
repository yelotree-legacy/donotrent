import { prisma } from "./db";
import { getSession } from "./session";
import { headers } from "next/headers";

export async function logSearch(query: string, field: string, resultsCount: number) {
  try {
    const session = await getSession();
    const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await prisma.searchLog.create({
      data: { query, field, resultsCount, companyId: session.companyId ?? null, ip },
    });
  } catch {
    // Never block on logging
  }
}

export async function logAudit(action: string, target: string, metadata?: Record<string, unknown>) {
  try {
    const session = await getSession();
    await prisma.auditEvent.create({
      data: {
        action,
        target,
        actorId: session.companyId ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch {
    // ignore
  }
}
