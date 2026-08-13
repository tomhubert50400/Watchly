CREATE TYPE "ReleaseDatePrecision" AS ENUM ('DATE', 'UNKNOWN');
CREATE TYPE "ReleaseEventStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');
CREATE TYPE "ReleaseEventSyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

CREATE TABLE "release_events" (
    "id" UUID NOT NULL,
    "source" VARCHAR(32) NOT NULL DEFAULT 'TMDB',
    "sourceKey" VARCHAR(160) NOT NULL,
    "type" "ReleaseNotificationType" NOT NULL,
    "contentType" "TrackedContentType" NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "title" VARCHAR(160) NOT NULL,
    "releaseDate" DATE,
    "precision" "ReleaseDatePrecision" NOT NULL DEFAULT 'UNKNOWN',
    "timeZone" VARCHAR(64),
    "regionCode" CHAR(2),
    "status" "ReleaseEventStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "release_event_sync_runs" (
    "id" UUID NOT NULL,
    "status" "ReleaseEventSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "contentCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "withdrawnCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" VARCHAR(1000),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "release_event_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "release_events_sourceKey_key" ON "release_events"("sourceKey");
CREATE INDEX "release_events_contentType_tmdbId_status_releaseDate_idx" ON "release_events"("contentType", "tmdbId", "status", "releaseDate");
CREATE INDEX "release_events_status_releaseDate_idx" ON "release_events"("status", "releaseDate");
CREATE INDEX "release_event_sync_runs_startedAt_idx" ON "release_event_sync_runs"("startedAt");
CREATE INDEX "release_event_sync_runs_status_startedAt_idx" ON "release_event_sync_runs"("status", "startedAt");

ALTER TABLE "notifications" ADD COLUMN "releaseEventId" UUID;
CREATE INDEX "notifications_releaseEventId_idx" ON "notifications"("releaseEventId");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_releaseEventId_fkey"
  FOREIGN KEY ("releaseEventId") REFERENCES "release_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Adopt the newest notification for each release milestone as the stable row.
-- Older duplicate history keeps its dated key and remains readable.
WITH ranked_release_notifications AS (
    SELECT
        "id",
        regexp_replace("dedupeKey", ':[0-9]{4}-[0-9]{2}-[0-9]{2}$', '') AS "stableKey",
        row_number() OVER (
            PARTITION BY "userId", regexp_replace("dedupeKey", ':[0-9]{4}-[0-9]{2}-[0-9]{2}$', '')
            ORDER BY "updatedAt" DESC, "createdAt" DESC
        ) AS "rank"
    FROM "notifications"
    WHERE "kind" = 'RELEASE'
      AND "dedupeKey" ~ ':[0-9]{4}-[0-9]{2}-[0-9]{2}$'
)
UPDATE "notifications" AS notification
SET "dedupeKey" = ranked."stableKey"
FROM ranked_release_notifications AS ranked
WHERE notification."id" = ranked."id"
  AND ranked."rank" = 1;
