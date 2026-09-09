ALTER TABLE "data_imports"
  ADD COLUMN "background" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "estimatedSeconds" INTEGER,
  ADD COLUMN "workerLease" UUID,
  ADD COLUMN "workerLeaseUntil" TIMESTAMP(3),
  ADD COLUMN "workerAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "workerNextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "dismissedAt" TIMESTAMP(3);

CREATE INDEX "data_imports_background_status_workerNextAttemptAt_idx"
  ON "data_imports"("background", "status", "workerNextAttemptAt");
