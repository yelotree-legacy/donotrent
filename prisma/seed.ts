import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORIES, SEED_ENTRIES } from "./seed-data";
import { normalizeName, normalizeLicense, splitName } from "../src/lib/normalize";

const prisma = new PrismaClient();

async function main() {
  console.log("→ seeding categories…");
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { label: c.label },
      create: c,
    });
  }

  console.log("→ seeding seed company (Supreme Sport Rental import)…");
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
      passwordHash,
      verified: true,
      isAdmin: false,
    },
  });

  console.log("→ seeding demo company (Acme Exotics)…");
  await prisma.company.upsert({
    where: { email: "demo@acmeexotics.test" },
    update: {},
    create: {
      name: "Acme Exotics",
      slug: "acme-exotics",
      email: "demo@acmeexotics.test",
      phone: "555-0100",
      city: "Los Angeles",
      state: "CA",
      passwordHash,
      verified: true,
    },
  });

  console.log("→ seeding admin account (admin@dnr.local)…");
  await prisma.company.upsert({
    where: { email: "admin@dnr.local" },
    update: { isAdmin: true, plan: "enterprise" },
    create: {
      name: "DNR Registry Admin",
      slug: "dnr-admin",
      email: "admin@dnr.local",
      passwordHash,
      verified: true,
      isAdmin: true,
      plan: "enterprise",
    },
  });

  console.log(`→ seeding ${SEED_ENTRIES.length} DNR entries…`);
  const allCategories = await prisma.category.findMany();
  const catBySlug = new Map(allCategories.map((c) => [c.slug, c]));

  // Wipe and re-seed entries (idempotent).
  await prisma.dnrEntry.deleteMany({ where: { importedFrom: "supremesportrental.com" } });

  for (const e of SEED_ENTRIES) {
    const parts = splitName(e.fullName);
    const created = await prisma.dnrEntry.create({
      data: {
        fullName: e.fullName,
        fullNameNorm: normalizeName(e.fullName),
        firstName: parts.first,
        middleName: parts.middle,
        lastName: parts.last,
        aliases: e.aliases ? JSON.stringify(e.aliases) : null,
        licenseId: null,
        licenseIdNorm: null,
        primaryReason: e.primaryReason,
        damageAmount: e.damageAmount,
        severity: e.severity ?? "MEDIUM",
        status: e.fullName.includes("Shaddai") ? "REFORMED" : "ACTIVE",
        importedFrom: "supremesportrental.com",
        sourceUrl: "https://supremesportrental.com/pages/do-not-rent-list",
        createdById: seedCo.id,
        reasons: { create: [{ text: e.primaryReason, amount: e.damageAmount }] },
      },
    });

    for (const slug of e.categories) {
      const cat = catBySlug.get(slug);
      if (cat) {
        await prisma.entryCategory.create({
          data: { entryId: created.id, categoryId: cat.id },
        });
      }
    }
  }

  const count = await prisma.dnrEntry.count();
  console.log(`✓ done — ${count} total entries in DB`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
