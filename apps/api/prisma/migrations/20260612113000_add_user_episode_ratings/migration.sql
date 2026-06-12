CREATE TABLE "user_episode_ratings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "seriesTmdbId" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "scoreHalfSteps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_episode_ratings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_episode_ratings_scoreHalfSteps_check" CHECK ("scoreHalfSteps" >= 1 AND "scoreHalfSteps" <= 10),
    CONSTRAINT "user_episode_ratings_seasonNumber_check" CHECK ("seasonNumber" >= 0),
    CONSTRAINT "user_episode_ratings_episodeNumber_check" CHECK ("episodeNumber" >= 1)
);

CREATE UNIQUE INDEX "user_episode_ratings_userId_seriesTmdbId_seasonNumber_episodeNumber_key" ON "user_episode_ratings"("userId", "seriesTmdbId", "seasonNumber", "episodeNumber");
CREATE INDEX "user_episode_ratings_userId_idx" ON "user_episode_ratings"("userId");
CREATE INDEX "user_episode_ratings_seriesTmdbId_seasonNumber_idx" ON "user_episode_ratings"("seriesTmdbId", "seasonNumber");

ALTER TABLE "user_episode_ratings" ADD CONSTRAINT "user_episode_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
