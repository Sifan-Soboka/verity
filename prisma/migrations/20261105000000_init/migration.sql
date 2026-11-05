-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthlyIncome" REAL NOT NULL,
    "dtiRatio" REAL NOT NULL,
    "creditScore" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "threshold" REAL NOT NULL,
    "incomeContribution" REAL NOT NULL,
    "dtiContribution" REAL NOT NULL,
    "creditContribution" REAL NOT NULL,
    "factorDetails" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "submissionKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_submissionKey_key" ON "Application"("submissionKey");

-- CreateIndex
CREATE INDEX "Application_createdAt_idx" ON "Application"("createdAt");
