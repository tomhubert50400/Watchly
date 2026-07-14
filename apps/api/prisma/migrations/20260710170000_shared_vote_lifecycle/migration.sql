-- Add lifecycle state in place so existing sessions, candidates, and votes keep
-- their identities and history. Existing sessions receive the same seven-day
-- close horizon they would have received if created under the new schema.
CREATE TYPE "SharedVotingStatus" AS ENUM ('OPEN', 'CLOSED');

ALTER TABLE "shared_voting_sessions"
  ADD COLUMN "status" "SharedVotingStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "closesAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "winningCandidateId" UUID;

UPDATE "shared_voting_sessions"
SET "closesAt" = "createdAt" + INTERVAL '7 days'
WHERE "closesAt" IS NULL;

ALTER TABLE "shared_voting_sessions"
  ALTER COLUMN "closesAt" SET NOT NULL,
  ALTER COLUMN "closesAt" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days');

CREATE INDEX "shared_voting_sessions_status_closesAt_idx"
  ON "shared_voting_sessions"("status", "closesAt");
CREATE INDEX "shared_voting_sessions_winningCandidateId_idx"
  ON "shared_voting_sessions"("winningCandidateId");

ALTER TABLE "shared_voting_sessions"
  ADD CONSTRAINT "shared_voting_sessions_winningCandidateId_fkey"
  FOREIGN KEY ("winningCandidateId") REFERENCES "shared_voting_candidates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
