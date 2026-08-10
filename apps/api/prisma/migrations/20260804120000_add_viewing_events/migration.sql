CREATE TYPE "ViewingContentType" AS ENUM ('MOVIE', 'EPISODE');

CREATE TABLE "viewing_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "contentType" "ViewingContentType" NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "title" TEXT,
    "subtitle" TEXT,
    "artworkUrl" TEXT,
    "genres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "runtimeMinutes" INTEGER,
    "watchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viewing_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "viewing_events_runtimeMinutes_check" CHECK ("runtimeMinutes" IS NULL OR "runtimeMinutes" >= 1),
    CONSTRAINT "viewing_events_episode_shape_check" CHECK (
      ("contentType" = 'MOVIE' AND "seasonNumber" IS NULL AND "episodeNumber" IS NULL)
      OR
      ("contentType" = 'EPISODE' AND "seasonNumber" IS NOT NULL AND "seasonNumber" >= 0 AND "episodeNumber" IS NOT NULL AND "episodeNumber" >= 1)
    )
);

CREATE INDEX "viewing_events_userId_watchedAt_idx" ON "viewing_events"("userId", "watchedAt");
CREATE INDEX "viewing_events_userId_contentType_tmdbId_idx" ON "viewing_events"("userId", "contentType", "tmdbId");
CREATE INDEX "viewing_events_userId_contentType_tmdbId_seasonNumber_episodeNumber_idx" ON "viewing_events"("userId", "contentType", "tmdbId", "seasonNumber", "episodeNumber");

ALTER TABLE "viewing_events" ADD CONSTRAINT "viewing_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "viewing_events" (
  "userId",
  "contentType",
  "tmdbId",
  "watchedAt"
)
SELECT
  "userId",
  'MOVIE'::"ViewingContentType",
  "tmdbId",
  NULL
FROM "user_content_states"
WHERE "contentType" = 'MOVIE' AND "status" = 'WATCHED';

INSERT INTO "viewing_events" (
  "userId",
  "contentType",
  "tmdbId",
  "seasonNumber",
  "episodeNumber",
  "watchedAt"
)
SELECT
  "userId",
  'EPISODE'::"ViewingContentType",
  "seriesTmdbId",
  "seasonNumber",
  "episodeNumber",
  "watchedAt"
FROM "user_episode_progress";
