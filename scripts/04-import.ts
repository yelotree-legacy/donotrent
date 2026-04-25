// Apply extracted license fields + photos to existing DB rows. Match on
// normalized full name (the seed import wrote that already). Idempotent.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { normalizeLicense, normalizeName } from "../src/lib/normalize";

const prisma = new PrismaClient();

type Extracted = {
  name: string;
  reason: string;
  localPath: string;
  imageUrl: string;
  licenseId: string | null;
  licenseState: string | null;
  dob: string | null;
  expiry: string | null;
  issued: string | null;
  ocrConfidence: string;
  address: string | null;
  sex: string | null;
};

const data: Extracted[] = JSON.parse(
  readFileSync(join(process.cwd(), "scripts", "out", "extracted.json"), "utf8")
);

(async () => {
  console.log(`→ importing ${data.length} extracted records into DB…`);
  let matched = 0, created = 0, photosAdded = 0, idsCaptured = 0, skipped = 0;
  const seedCo = await prisma.company.findUnique({ where: { email: "import@supremesportrental.com" } });
  if (!seedCo) throw new Error("seed company not found — run npm run db:seed first");

  for (const r of data) {
    const norm = normalizeName(r.name);
    if (!norm) { skipped++; continue; }

    let entry = await prisma.dnrEntry.findFirst({
      where: { fullNameNorm: norm, importedFrom: "supremesportrental.com" },
      include: { photos: true },
    });

    if (!entry) {
      // Page had a few names absent from the seeded list (e.g. "Makhi Norrell Kent"
      // vs "Mitch Norrell Kent"). Create the entry so we don't lose the photo.
      entry = await prisma.dnrEntry.create({
        data: {
          fullName: r.name,
          fullNameNorm: norm,
          primaryReason: r.reason || "Imported from supremesportrental.com",
          severity: "MEDIUM",
          importedFrom: "supremesportrental.com",
          sourceUrl: "https://supremesportrental.com/pages/do-not-rent-list",
          createdById: seedCo.id,
          status: "ACTIVE",
          reasons: r.reason ? { create: [{ text: r.reason }] } : undefined,
        },
        include: { photos: true },
      });
      created++;
    } else {
      matched++;
    }

    // Update license fields
    const updates: any = {};
    if (r.licenseId && !entry.licenseId) {
      updates.licenseId = r.licenseId;
      updates.licenseIdNorm = normalizeLicense(r.licenseId);
      idsCaptured++;
    }
    if (r.licenseState && !entry.licenseState) updates.licenseState = r.licenseState;
    if (r.dob && !entry.dateOfBirth) updates.dateOfBirth = new Date(r.dob);
    if (r.expiry && !entry.licenseExpiry) updates.licenseExpiry = new Date(r.expiry);

    // Append OCR notes to detailedNotes if we extracted something useful (and not already there).
    const noteBits: string[] = [];
    if (r.licenseId) noteBits.push(`OCR license: ${r.licenseId}${r.licenseState ? ` (${r.licenseState})` : ""}`);
    if (r.dob) noteBits.push(`DOB: ${r.dob}`);
    if (r.expiry) noteBits.push(`Expires: ${r.expiry}`);
    if (r.address) noteBits.push(`Address: ${r.address}`);
    if (r.sex) noteBits.push(`Sex: ${r.sex}`);
    if (noteBits.length) {
      const newNotes = noteBits.join(" · ");
      const existing = entry.detailedNotes || "";
      if (!existing.includes("OCR license:")) {
        updates.detailedNotes = existing
          ? `${existing}\n\n[OCR ${r.ocrConfidence}] ${newNotes}`
          : `[OCR ${r.ocrConfidence}] ${newNotes}`;
      }
    }

    if (Object.keys(updates).length) {
      await prisma.dnrEntry.update({ where: { id: entry.id }, data: updates });
    }

    // Attach photo if not already
    const already = entry.photos.find((p) => p.url === r.localPath);
    if (!already && r.localPath) {
      await prisma.photo.create({
        data: {
          entryId: entry.id,
          url: r.localPath,
          kind: "LICENSE_FRONT",
          caption: `Imported from supremesportrental.com (OCR ${r.ocrConfidence})`,
        },
      });
      photosAdded++;
    }
  }

  console.log(`✓ done — ${matched} matched, ${created} created, ${photosAdded} photos added, ${idsCaptured} license IDs captured, ${skipped} skipped`);

  const totals = {
    entries: await prisma.dnrEntry.count(),
    withLicense: await prisma.dnrEntry.count({ where: { licenseId: { not: null } } }),
    withPhoto: await prisma.photo.count(),
  };
  console.log("DB now:", totals);
  await prisma.$disconnect();
})();
