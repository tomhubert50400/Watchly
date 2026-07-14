-- Generalize the existing release notification table in place. Renames preserve
-- every row, primary key, read state, and timestamp from release_notifications.
CREATE TYPE "NotificationKind" AS ENUM ('RELEASE', 'SHARED_LIST_INVITE', 'SHARED_VOTE_UPDATE');

ALTER TABLE "release_notifications" RENAME TO "notifications";
ALTER TABLE "notifications" RENAME COLUMN "type" TO "releaseType";
ALTER TABLE "notifications" RENAME COLUMN "generatedKey" TO "dedupeKey";
ALTER TABLE "notifications" ADD COLUMN "kind" "NotificationKind" NOT NULL DEFAULT 'RELEASE';
ALTER TABLE "notifications" ADD COLUMN "sharedWatchlistId" UUID;
ALTER TABLE "notifications" ADD COLUMN "votingSessionId" UUID;
ALTER TABLE "notifications" ADD COLUMN "actorUserId" UUID;
ALTER TABLE "notifications" ADD COLUMN "routeMetadata" JSONB;
ALTER TABLE "notifications" ALTER COLUMN "releaseType" DROP NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "contentType" DROP NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "tmdbId" DROP NOT NULL;

ALTER INDEX "release_notifications_pkey" RENAME TO "notifications_pkey";
ALTER INDEX "release_notifications_userId_generatedKey_key" RENAME TO "notifications_userId_dedupeKey_key";
ALTER INDEX "release_notifications_userId_readAt_createdAt_idx" RENAME TO "notifications_userId_readAt_createdAt_idx";
ALTER INDEX "release_notifications_contentType_tmdbId_idx" RENAME TO "notifications_contentType_tmdbId_idx";
ALTER TABLE "notifications" RENAME CONSTRAINT "release_notifications_userId_fkey" TO "notifications_userId_fkey";

CREATE INDEX "notifications_sharedWatchlistId_idx" ON "notifications"("sharedWatchlistId");
CREATE INDEX "notifications_votingSessionId_idx" ON "notifications"("votingSessionId");
CREATE INDEX "notifications_actorUserId_idx" ON "notifications"("actorUserId");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sharedWatchlistId_fkey"
  FOREIGN KEY ("sharedWatchlistId") REFERENCES "shared_watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_votingSessionId_fkey"
  FOREIGN KEY ("votingSessionId") REFERENCES "shared_voting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
