CREATE TYPE "AuditAction" AS ENUM ('PRIVACY_UPDATED', 'USER_BLOCKED', 'USER_UNBLOCKED');

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "targetUserId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");
