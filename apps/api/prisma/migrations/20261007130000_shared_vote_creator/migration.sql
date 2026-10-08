ALTER TABLE "shared_voting_sessions" ADD COLUMN "creatorId" UUID;
ALTER TABLE "shared_voting_sessions" ADD CONSTRAINT "shared_voting_sessions_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "shared_voting_sessions_creatorId_idx" ON "shared_voting_sessions"("creatorId");

-- Creation alerts record the actual initiator, who may differ from the list owner.
UPDATE "shared_voting_sessions" AS session
SET "creatorId" = notification."actorUserId"
FROM "notifications" AS notification
WHERE notification."votingSessionId" = session.id
  AND notification."dedupeKey" = 'shared-vote-start:' || session.id::text
  AND notification."actorUserId" IS NOT NULL;
