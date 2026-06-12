CREATE TABLE "user_episode_progress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "seriesTmdbId" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_episode_progress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_episode_progress_seasonNumber_check" CHECK ("seasonNumber" >= 0),
    CONSTRAINT "user_episode_progress_episodeNumber_check" CHECK ("episodeNumber" >= 1)
);

CREATE UNIQUE INDEX "user_episode_progress_userId_seriesTmdbId_seasonNumber_episodeNumber_key" ON "user_episode_progress"("userId", "seriesTmdbId", "seasonNumber", "episodeNumber");
CREATE INDEX "user_episode_progress_userId_idx" ON "user_episode_progress"("userId");
CREATE INDEX "user_episode_progress_seriesTmdbId_seasonNumber_idx" ON "user_episode_progress"("seriesTmdbId", "seasonNumber");

ALTER TABLE "user_episode_progress" ADD CONSTRAINT "user_episode_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
