// Stripe Identity orchestration. Two operations:
//   - createVerificationSession(checkId, returnUrl) → starts a session,
//     persists the resulting URL/clientSecret on the CheckSession row.
//   - applyVerificationEvent(event) → consumes a Stripe webhook event,
//     copies extracted document fields onto the CheckSession.

import type Stripe from "stripe";
import { prisma } from "./db";
import { getStripe } from "./stripe";
import { logAudit } from "./audit";
import { normalizeLicense } from "./normalize";

export async function createVerificationSession(opts: {
  checkId: string;
  returnUrl: string;
  metadata?: Record<string, string>;
}) {
  const check = await prisma.checkSession.findUnique({ where: { id: opts.checkId } });
  if (!check) throw new Error("CheckSession not found");

  // If a session already exists, return its URL.
  if (check.idvSessionId && check.idvUrl) {
    return { sessionId: check.idvSessionId, url: check.idvUrl, clientSecret: check.idvClientSecret };
  }

  const stripe = getStripe();
  const provided: Record<string, string> = {};
  if (check.fullName) {
    const parts = check.fullName.trim().split(/\s+/);
    if (parts.length >= 1) provided.first_name = parts[0];
    if (parts.length >= 2) provided.last_name = parts[parts.length - 1];
  }
  if (check.dateOfBirth) {
    const d = check.dateOfBirth;
    provided.dob = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
  }

  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    options: {
      document: {
        require_id_number: true,
        require_matching_selfie: true,
        require_live_capture: true,
        allowed_types: ["driving_license", "id_card", "passport"],
      },
    },
    return_url: opts.returnUrl,
    metadata: { ...opts.metadata, check_id: opts.checkId, ...provided },
  });

  await prisma.checkSession.update({
    where: { id: opts.checkId },
    data: {
      idvSessionId: session.id,
      idvClientSecret: session.client_secret ?? null,
      idvUrl: session.url ?? null,
      idvReturnUrl: opts.returnUrl,
      idvStatus: "pending",
    },
  });

  await logAudit("idv.create", opts.checkId, { stripeSessionId: session.id });

  return { sessionId: session.id, url: session.url, clientSecret: session.client_secret };
}

export async function applyVerificationEvent(event: Stripe.Event) {
  const obj = event.data.object as Stripe.Identity.VerificationSession;
  const checkId = obj.metadata?.check_id;
  if (!checkId) return;

  const stripe = getStripe();

  // For verified events, expand to get the actual extracted document fields.
  const verified = event.type === "identity.verification_session.verified";
  const full = verified
    ? await stripe.identity.verificationSessions.retrieve(obj.id, {
        expand: ["verified_outputs", "last_verification_report"],
      })
    : obj;

  const status = mapStatus(event.type, full.status);
  const verifiedOutputs = (full as any).verified_outputs as Stripe.Identity.VerificationSession.VerifiedOutputs | null;
  const lastReport = (full as any).last_verification_report as Stripe.Identity.VerificationReport | null;

  const update: any = {
    idvStatus: status,
    idvErrorCode: full.last_error?.code ?? null,
  };

  if (verifiedOutputs) {
    update.idvVerifiedFirstName = verifiedOutputs.first_name ?? null;
    update.idvVerifiedLastName = verifiedOutputs.last_name ?? null;
    update.idvVerifiedName = [verifiedOutputs.first_name, verifiedOutputs.last_name].filter(Boolean).join(" ") || null;
    if (verifiedOutputs.dob) {
      const { year, month, day } = verifiedOutputs.dob;
      if (year && month && day) update.idvVerifiedDob = new Date(Date.UTC(year, month - 1, day));
    }
    update.idvDocNumber = verifiedOutputs.id_number ?? null;
  }
  if (lastReport?.document) {
    update.idvDocType = lastReport.document.type ?? null;
    update.idvDocCountry = lastReport.document.issuing_country ?? null;
    if (lastReport.document.expiration_date) {
      const { year, month, day } = lastReport.document.expiration_date;
      if (year && month && day) update.idvDocExpiry = new Date(Date.UTC(year, month - 1, day));
    }
  }
  if (lastReport?.selfie) {
    update.idvSelfieMatch = lastReport.selfie.status === "verified";
  }
  if (status === "verified" || status === "failed" || status === "canceled") {
    update.idvCompletedAt = new Date();
  }

  await prisma.checkSession.update({ where: { idvSessionId: full.id }, data: update });
  await logAudit(`idv.${status}`, checkId, { stripeSessionId: full.id });
}

function mapStatus(eventType: string, sessionStatus: string): string {
  if (eventType === "identity.verification_session.verified") return "verified";
  if (eventType === "identity.verification_session.canceled") return "canceled";
  if (eventType === "identity.verification_session.requires_input") return "requires_input";
  if (eventType === "identity.verification_session.processing") return "pending";
  // Fall back to session status if event type is unknown.
  return sessionStatus === "verified" ? "verified" : sessionStatus === "canceled" ? "canceled" : "pending";
}

export function looksLikeMatch(check: {
  licenseId?: string | null;
  fullName?: string | null;
  dateOfBirth?: Date | null;
  idvDocNumber?: string | null;
  idvVerifiedName?: string | null;
  idvVerifiedDob?: Date | null;
}): { licenseMatch: boolean; nameMatch: boolean; dobMatch: boolean } {
  const licenseMatch = Boolean(
    check.licenseId && check.idvDocNumber &&
    normalizeLicense(check.licenseId) === normalizeLicense(check.idvDocNumber)
  );
  const nameMatch = Boolean(
    check.fullName && check.idvVerifiedName &&
    check.fullName.toLowerCase().replace(/[^a-z]/g, "") ===
    check.idvVerifiedName.toLowerCase().replace(/[^a-z]/g, "")
  );
  const dobMatch = Boolean(
    check.dateOfBirth && check.idvVerifiedDob &&
    check.dateOfBirth.toISOString().slice(0, 10) === check.idvVerifiedDob.toISOString().slice(0, 10)
  );
  return { licenseMatch, nameMatch, dobMatch };
}
