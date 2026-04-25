// Public API endpoint for cross-source DNR + OFAC checks.
// Auth: Bearer token (generate at /dashboard/api).
// Plan: requires Pro or Pro+ (apiAccess flag in plan config).
// Quota: counts against the company's monthly Rent Report cap.
//
// POST /api/v1/check
// Authorization: Bearer dnr_live_xxxx
// Body:
//   { name?: string, license_id?: string, license_state?: string, dob?: string }
// Response: 200 with verdict + matches.
//   401 missing/invalid bearer · 403 plan lacks API access ·
//   429 monthly quota reached · 400 bad input · 500 internal error.

import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/api-key";
import { getPlan } from "@/lib/plans";
import { canConsumeCheck, incrementCheck } from "@/lib/usage";
import { isFreeTier } from "@/lib/billing-mode";
import { crossCheck } from "@/lib/cross-check";
import { checkOfac } from "@/lib/checks/ofac";
import { prisma } from "@/lib/db";
import { logSearch } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 30;

function err(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const authHeader = req.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/);
  if (!m) return err(401, "unauthenticated", "Missing Bearer token. Use: Authorization: Bearer dnr_live_…");
  const auth = await verifyApiKey(m[1].trim());
  if (!auth) return err(401, "invalid_token", "Invalid or revoked API key.");

  // 2. Plan gating — bypassed in free-tier mode.
  const plan = getPlan(auth.plan);
  if (!isFreeTier() && !plan.apiAccess) {
    return err(403, "plan_required", "API access requires Pro or Pro+ plan.", {
      current_plan: plan.slug,
      upgrade_url: "/pricing",
    });
  }

  // 3. Quota
  const allowed = await canConsumeCheck(auth.companyId);
  if (!allowed.ok) {
    return err(429, "quota_exceeded", "Monthly Rent Report limit reached.", {
      plan: plan.slug,
      limit: "limit" in allowed ? allowed.limit : null,
      reset: "next billing period",
      upgrade_url: "/pricing",
    });
  }

  // 4. Parse + validate body
  let body: any;
  try { body = await req.json(); }
  catch { return err(400, "invalid_json", "Body must be valid JSON."); }

  const fullName = String(body.name ?? body.full_name ?? "").trim();
  const licenseId = String(body.license_id ?? body.licenseId ?? "").trim();
  const licenseState = String(body.license_state ?? body.licenseState ?? "").trim().toUpperCase().slice(0, 2);
  const dob = String(body.dob ?? body.date_of_birth ?? "").trim();

  if (!fullName && !licenseId) {
    return err(400, "missing_input", "Provide at least one of: name, license_id.");
  }
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return err(400, "invalid_dob", "dob must be ISO format YYYY-MM-DD.");
  }

  // 5. Run checks (cross-source + OFAC in parallel)
  const [xc, ofac] = await Promise.all([
    crossCheck({
      fullName: fullName || undefined,
      licenseId: licenseId || undefined,
      dateOfBirth: dob || undefined,
    }),
    fullName ? checkOfac(fullName) : Promise.resolve({ status: "clear" as const }),
  ]);

  // 6. Combine verdict — OFAC match auto-declines.
  let verdict = xc.verdict;
  let riskScore = xc.riskScore;
  if (ofac.status === "match") {
    verdict = "DECLINE";
    riskScore = Math.max(riskScore, 95);
  }

  // 7. Persist as CheckSession + bill against quota
  const session = await prisma.checkSession.create({
    data: {
      fullName: fullName || null,
      licenseId: licenseId || null,
      dateOfBirth: dob ? new Date(dob) : null,
      verdict,
      riskScore,
      totalHits: xc.totalHits,
      matchedSources: xc.matchedSources,
      worstSeverity: xc.worstSeverity,
      companyId: auth.companyId,
      ofacStatus: ofac.status,
      ofacMatchCount: ofac.status === "match" ? ofac.matches.length : 0,
      ofacMatchesJson: ofac.status === "match" ? JSON.stringify(ofac.matches) : null,
      ofacCheckedAt: new Date(),
    },
  });
  await incrementCheck(auth.companyId);
  await logSearch(`api: ${fullName || licenseId}`, licenseId ? "license" : "name", xc.totalHits);

  // 8. Response
  return NextResponse.json({
    id: session.id,
    verdict,
    risk_score: riskScore,
    matched_sources: xc.matchedSources,
    total_sources: xc.totalSources,
    total_hits: xc.totalHits,
    worst_severity: xc.worstSeverity,
    query: { name: fullName || null, license_id: licenseId || null, license_state: licenseState || null, dob: dob || null },
    ofac: ofac.status === "match"
      ? { status: "match", matches: ofac.matches.map((m) => ({ name: m.name, programs: m.programs, score: m.score })) }
      : { status: ofac.status },
    hits: xc.hits.map((h) => ({
      id: h.id,
      full_name: h.fullName,
      license_id: h.licenseId,
      license_state: h.licenseState,
      severity: h.severity,
      status: h.status,
      primary_reason: h.primaryReason,
      damage_amount: h.damageAmount,
      matched_on: h.matchedOn,
      thumbnail_url: h.thumbnailUrl,
      source: h.source ? { id: h.source.id, slug: h.source.slug, name: h.source.name } : null,
    })),
    plan_info: {
      plan: plan.slug,
      remaining_checks: allowed.ok && "remaining" in allowed && allowed.remaining !== Infinity
        ? Math.max(0, allowed.remaining - 1)
        : null,
    },
  });
}

// Optional: GET also supports lookup by query params for convenience.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  // Re-route through POST path with the params as JSON
  const synthetic = new NextRequest(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify({
      name: params.get("name") ?? params.get("full_name") ?? undefined,
      license_id: params.get("license_id") ?? params.get("licenseId") ?? undefined,
      license_state: params.get("license_state") ?? undefined,
      dob: params.get("dob") ?? undefined,
    }),
  });
  return POST(synthetic);
}
