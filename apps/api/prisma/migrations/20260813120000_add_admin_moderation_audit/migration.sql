CREATE TYPE "AdminAuditAction" AS ENUM (
  'REPORT_LIST_VIEWED',
  'REPORT_VIEWED',
  'REPORT_STATUS_CHANGED'
);

CREATE TABLE "admin_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actorFirebaseUid" VARCHAR(128) NOT NULL,
  "actorEmail" VARCHAR(320) NOT NULL,
  "action" "AdminAuditAction" NOT NULL,
  "reportId" UUID,
  "reportedUserId" UUID,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_logs_actorFirebaseUid_createdAt_idx"
  ON "admin_audit_logs"("actorFirebaseUid", "createdAt");
CREATE INDEX "admin_audit_logs_action_createdAt_idx"
  ON "admin_audit_logs"("action", "createdAt");
CREATE INDEX "admin_audit_logs_reportId_createdAt_idx"
  ON "admin_audit_logs"("reportId", "createdAt");

CREATE FUNCTION prevent_admin_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'admin audit logs are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "admin_audit_logs_append_only"
BEFORE UPDATE OR DELETE ON "admin_audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_log_mutation();
