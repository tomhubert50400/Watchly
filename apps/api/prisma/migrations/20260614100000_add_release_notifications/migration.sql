CREATE TYPE "ReleaseNotificationType" AS ENUM ('MOVIE_RELEASE', 'SEASON_RELEASE', 'EPISODE_RELEASE');

CREATE TABLE "release_notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ReleaseNotificationType" NOT NULL,
    "contentType" "TrackedContentType" NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "generatedKey" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "release_notifications_userId_generatedKey_key" ON "release_notifications"("userId", "generatedKey");
CREATE INDEX "release_notifications_userId_readAt_createdAt_idx" ON "release_notifications"("userId", "readAt", "createdAt");
CREATE INDEX "release_notifications_contentType_tmdbId_idx" ON "release_notifications"("contentType", "tmdbId");

ALTER TABLE "release_notifications" ADD CONSTRAINT "release_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
