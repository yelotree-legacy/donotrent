-- AlterTable
ALTER TABLE "DnrEntry" ADD COLUMN     "sourceId" TEXT;

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'scraped',
    "url" TEXT,
    "region" TEXT,
    "description" TEXT,
    "trustScore" INTEGER NOT NULL DEFAULT 70,
    "lastSyncedAt" TIMESTAMP(3),
    "syncFrequency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_slug_key" ON "Source"("slug");

-- CreateIndex
CREATE INDEX "Source_slug_idx" ON "Source"("slug");

-- CreateIndex
CREATE INDEX "DnrEntry_sourceId_idx" ON "DnrEntry"("sourceId");

-- AddForeignKey
ALTER TABLE "DnrEntry" ADD CONSTRAINT "DnrEntry_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
