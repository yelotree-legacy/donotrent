// Reset license fields on imported entries so 04-import can re-apply with fresh extractor logic.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

(async () => {
  const r = await prisma.dnrEntry.updateMany({
    where: { importedFrom: "supremesportrental.com" },
    data: { licenseId: null, licenseIdNorm: null, licenseState: null, dateOfBirth: null, licenseExpiry: null, detailedNotes: null },
  });
  console.log(`cleared license fields on ${r.count} imported entries`);
  await prisma.$disconnect();
})();
