// One-shot seed pipeline. Use after `npm run db:push` instead of (or after)
// `db:seed`. Reuses cached extracted.json so it doesn't need to re-OCR.
//
//   npm run db:push
//   npm run db:seed:full
//
// What it does:
//   1. Ensures the seed companies exist (Supreme Sport Rental import,
//      Acme Exotics demo, DNR admin) and the violation categories.
//   2. Reads scripts/out/extracted.json (committed) and creates one entry
//      per record with the OCR-derived license_id, state, DOB, expiry, photo.
//   3. Falls back to prisma/seed-data.ts categorization for category tagging.
//
// To re-build extracted.json yourself (slow, ~3 min):
//   npx tsx scripts/01-download.ts
//   npx tsx scripts/02-ocr.ts
//   npx tsx scripts/03-extract.ts

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORIES, SEED_ENTRIES } from "../prisma/seed-data";
import { normalizeLicense, normalizeName, splitName } from "../src/lib/normalize";

const prisma = new PrismaClient();

type Extracted = {
  name: string;
  reason: string;
  imageUrl: string;
  localPath: string;
  licenseId: string | null;
  licenseState: string | null;
  dob: string | null;
  expiry: string | null;
  issued: string | null;
  sex: string | null;
  height: string | null;
  weight: string | null;
  eyes: string | null;
  hair: string | null;
  licenseClass: string | null;
  address: string | null;
  ocrConfidence: "high" | "medium" | "low" | "empty";
};

const extractedPath = join(process.cwd(), "scripts", "out", "extracted.json");
if (!existsSync(extractedPath)) {
  console.error(`✗ ${extractedPath} not found.`);
  console.error(`  Run the OCR pipeline first:`);
  console.error(`    npx tsx scripts/01-download.ts`);
  console.error(`    npx tsx scripts/02-ocr.ts`);
  console.error(`    npx tsx scripts/03-extract.ts`);
  process.exit(1);
}
const data: Extracted[] = JSON.parse(readFileSync(extractedPath, "utf8"));

(async () => {
  console.log("→ ensuring categories…");
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug }, update: { label: c.label }, create: c,
    });
  }

  console.log("→ ensuring sources…");
  const supremeSource = await prisma.source.upsert({
    where: { slug: "supreme-sport-rental" },
    update: {
      lastSyncedAt: new Date(),
      url: "https://supremesportrental.com/pages/do-not-rent-list",
    },
    create: {
      slug: "supreme-sport-rental",
      name: "Supreme Sport Rental",
      kind: "partner",
      url: "https://supremesportrental.com/pages/do-not-rent-list",
      region: "South Florida",
      description: "Public Do Not Rent list maintained by Supreme Sport Rental. Imported nightly.",
      trustScore: 80,
      lastSyncedAt: new Date(),
      syncFrequency: "daily",
    },
  });
  await prisma.source.upsert({
    where: { slug: "network-reports" },
    update: {},
    create: {
      slug: "network-reports",
      name: "Network Reports",
      kind: "network",
      region: "All",
      description: "Direct uploads from verified DNR Registry member companies. Highest confidence — first-party reports.",
      trustScore: 95,
      syncFrequency: "real-time",
    },
  });
  await prisma.source.upsert({
    where: { slug: "manual-disputes" },
    update: {},
    create: {
      slug: "manual-disputes",
      name: "Disputed Records",
      kind: "manual",
      region: "All",
      description: "Entries currently under dispute by the listed individual. Treat with caution.",
      trustScore: 50,
      syncFrequency: "manual",
    },
  });

  console.log("→ ensuring companies…");
  const passwordHash = await bcrypt.hash("admin1234", 10);
  const seedCo = await prisma.company.upsert({
    where: { email: "import@supremesportrental.com" },
    update: {},
    create: {
      name: "Supreme Sport Rental",
      slug: "supreme-sport-rental",
      email: "import@supremesportrental.com",
      phone: "728-777-3103",
      city: "Miami",
      state: "FL",
      passwordHash, verified: true,
    },
  });
  await prisma.company.upsert({
    where: { email: "demo@acmeexotics.test" },
    update: {},
    create: {
      name: "Acme Exotics", slug: "acme-exotics",
      email: "demo@acmeexotics.test", phone: "555-0100",
      city: "Los Angeles", state: "CA",
      passwordHash, verified: true,
    },
  });
  await prisma.company.upsert({
    where: { email: "admin@dnr.local" },
    update: { isAdmin: true },
    create: {
      name: "DNR Registry Admin", slug: "dnr-admin",
      email: "admin@dnr.local",
      passwordHash, verified: true, isAdmin: true,
    },
  });

  // Build a quick lookup table from the curated SEED_ENTRIES (the categorization layer).
  const curatedByNorm = new Map(
    SEED_ENTRIES.map((e) => [normalizeName(e.fullName), e])
  );

  const cats = await prisma.category.findMany();
  const catBySlug = new Map(cats.map((c) => [c.slug, c]));

  // Wipe any prior import to keep the seed deterministic.
  console.log("→ clearing prior imports…");
  await prisma.dnrEntry.deleteMany({ where: { importedFrom: "supremesportrental.com" } });

  console.log(`→ seeding ${data.length} entries from extracted.json…`);
  let withLicense = 0, withState = 0, withDob = 0, withExpiry = 0;

  for (const r of data) {
    const norm = normalizeName(r.name);
    const curated = curatedByNorm.get(norm);
    const parts = splitName(r.name);
    const aliases = curated?.aliases?.length ? JSON.stringify(curated.aliases) : null;

    const noteBits: string[] = [];
    if (r.licenseId) noteBits.push(`OCR license: ${r.licenseId}${r.licenseState ? ` (${r.licenseState})` : ""}`);
    if (r.dob) noteBits.push(`DOB: ${r.dob}`);
    if (r.expiry) noteBits.push(`Expires: ${r.expiry}`);
    if (r.issued) noteBits.push(`Issued: ${r.issued}`);
    if (r.address) noteBits.push(`Address: ${r.address}`);
    if (r.sex) noteBits.push(`Sex: ${r.sex}`);
    if (r.height) noteBits.push(`Height: ${r.height}`);
    if (r.weight) noteBits.push(`Weight: ${r.weight}`);
    if (r.eyes) noteBits.push(`Eyes: ${r.eyes}`);
    if (r.licenseClass) noteBits.push(`Class: ${r.licenseClass}`);

    const detailedNotes = noteBits.length
      ? `[OCR ${r.ocrConfidence}] ${noteBits.join(" · ")}`
      : null;

    const entry = await prisma.dnrEntry.create({
      data: {
        fullName: r.name,
        fullNameNorm: norm,
        firstName: parts.first,
        middleName: parts.middle,
        lastName: parts.last,
        aliases,
        licenseId: r.licenseId,
        licenseIdNorm: r.licenseId ? normalizeLicense(r.licenseId) : null,
        licenseState: r.licenseState,
        dateOfBirth: r.dob ? new Date(r.dob) : null,
        licenseExpiry: r.expiry ? new Date(r.expiry) : null,
        primaryReason: curated?.primaryReason || r.reason || "Imported from supremesportrental.com",
        detailedNotes,
        damageAmount: curated?.damageAmount,
        severity: curated?.severity || (r.licenseId ? "MEDIUM" : "MEDIUM"),
        status: r.name.includes("Shaddai") ? "REFORMED" : "ACTIVE",
        importedFrom: "supremesportrental.com",
        sourceId: supremeSource.id,
        sourceUrl: "https://supremesportrental.com/pages/do-not-rent-list",
        createdById: seedCo.id,
        reasons: { create: [{ text: r.reason || curated?.primaryReason || "—" }] },
        photos: r.imageUrl ? {
          create: [{
            // Reference the public Shopify CDN URL directly so we don't need to
            // host these images ourselves. Vercel-friendly out of the box.
            url: r.imageUrl,
            kind: "LICENSE_FRONT",
            caption: `Imported from supremesportrental.com (OCR ${r.ocrConfidence})`
          }]
        } : undefined,
      },
    });

    if (curated?.categories?.length) {
      const slugs = curated.categories;
      const ec = slugs.map((s) => catBySlug.get(s)).filter(Boolean) as { id: string }[];
      await prisma.entryCategory.createMany({
        data: ec.map((c) => ({ entryId: entry.id, categoryId: c.id })),
      });
    }

    if (r.licenseId) withLicense++;
    if (r.licenseState) withState++;
    if (r.dob) withDob++;
    if (r.expiry) withExpiry++;
  }

  console.log(`✓ seed complete`);
  console.log(`  ${data.length} entries, ${withLicense} licenses, ${withState} states, ${withDob} DOBs, ${withExpiry} expirations`);
  await prisma.$disconnect();
})();
