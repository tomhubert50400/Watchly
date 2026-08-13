ALTER TYPE "AdminAuditAction" ADD VALUE 'USER_LIST_VIEWED';
ALTER TYPE "AdminAuditAction" ADD VALUE 'USER_VIEWED';

ALTER TABLE "users" ADD COLUMN "suspendedUntil" TIMESTAMP(3);
ALTER TABLE "auth_identities" ADD COLUMN "email" VARCHAR(320);

CREATE TABLE "user_suspensions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "reportId" UUID,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "liftedAt" TIMESTAMP(3),
  "note" TEXT NOT NULL,
  "createdByFirebaseUid" VARCHAR(128) NOT NULL,
  "createdByEmail" VARCHAR(320) NOT NULL,
  "liftedNote" TEXT,
  "liftedByFirebaseUid" VARCHAR(128),
  "liftedByEmail" VARCHAR(320),

  CONSTRAINT "user_suspensions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_suspensions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_suspensions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "content_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "user_suspensions_userId_startsAt_idx" ON "user_suspensions"("userId", "startsAt");
CREATE INDEX "user_suspensions_reportId_idx" ON "user_suspensions"("reportId");

INSERT INTO "user_suspensions" (
  "userId",
  "startsAt",
  "note",
  "createdByFirebaseUid",
  "createdByEmail"
)
SELECT
  "id",
  "suspendedAt",
  'Legacy suspension migrated into the moderation registry.',
  'migration',
  'system@watchly.local'
FROM "users"
WHERE "suspendedAt" IS NOT NULL;
