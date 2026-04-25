-- CreateTable
CREATE TABLE "CheckSession" (
    "id" TEXT NOT NULL,
    "fullName" TEXT,
    "licenseId" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "verdict" TEXT,
    "riskScore" INTEGER,
    "totalHits" INTEGER NOT NULL DEFAULT 0,
    "matchedSources" INTEGER NOT NULL DEFAULT 0,
    "worstSeverity" TEXT,
    "idvStatus" TEXT NOT NULL DEFAULT 'not_started',
    "idvSessionId" TEXT,
    "idvClientSecret" TEXT,
    "idvUrl" TEXT,
    "idvReturnUrl" TEXT,
    "idvVerifiedName" TEXT,
    "idvVerifiedFirstName" TEXT,
    "idvVerifiedLastName" TEXT,
    "idvVerifiedDob" TIMESTAMP(3),
    "idvDocType" TEXT,
    "idvDocNumber" TEXT,
    "idvDocCountry" TEXT,
    "idvDocState" TEXT,
    "idvDocExpiry" TIMESTAMP(3),
    "idvSelfieMatch" BOOLEAN,
    "idvErrorCode" TEXT,
    "idvCompletedAt" TIMESTAMP(3),
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckSession_idvSessionId_key" ON "CheckSession"("idvSessionId");

-- CreateIndex
CREATE INDEX "CheckSession_companyId_idx" ON "CheckSession"("companyId");

-- CreateIndex
CREATE INDEX "CheckSession_createdAt_idx" ON "CheckSession"("createdAt");

-- CreateIndex
CREATE INDEX "CheckSession_idvSessionId_idx" ON "CheckSession"("idvSessionId");

-- AddForeignKey
ALTER TABLE "CheckSession" ADD CONSTRAINT "CheckSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
