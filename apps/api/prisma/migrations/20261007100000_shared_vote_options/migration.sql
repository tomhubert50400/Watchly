ALTER TABLE "shared_voting_sessions" ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT true;

UPDATE "notifications"
SET "actorUserId" = NULL
WHERE "kind" = 'SHARED_VOTE_UPDATE' AND "dedupeKey" LIKE 'shared-vote-update:%';
