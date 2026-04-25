import { PrismaClient } from "@prisma/client";
import { CATEGORIES, SEED_ENTRIES } from "./seed-data";
import { normalizeName, splitName } from "../src/lib/normalize";

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

  // Note: demo accounts are intentionally not seeded. Create your own admin
  // account directly in the DB after running this seed (see scripts/01-create-admin.ts
  // or insert via Prisma Studio).
  // The 264 imported entries below have createdById = null and are credited to
  // the Source ('Supreme Sport Rental') instead of a Company row.
  const seedCo = { id: null as string | null }; // sentinel — entries get sourceId for attribution

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
