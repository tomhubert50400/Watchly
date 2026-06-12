CREATE TABLE "user_movie_reviews" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "body" VARCHAR(5000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_movie_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_movie_reviews_body_not_blank_check" CHECK (length(btrim("body")) > 0)
);

CREATE TABLE "user_episode_reviews" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "seriesTmdbId" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "body" VARCHAR(5000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_episode_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_episode_reviews_body_not_blank_check" CHECK (length(btrim("body")) > 0),
    CONSTRAINT "user_episode_reviews_seasonNumber_check" CHECK ("seasonNumber" >= 0),
    CONSTRAINT "user_episode_reviews_episodeNumber_check" CHECK ("episodeNumber" >= 1)
);

CREATE UNIQUE INDEX "user_movie_reviews_userId_tmdbId_key" ON "user_movie_reviews"("userId", "tmdbId");
CREATE INDEX "user_movie_reviews_userId_idx" ON "user_movie_reviews"("userId");
CREATE INDEX "user_movie_reviews_tmdbId_idx" ON "user_movie_reviews"("tmdbId");

CREATE UNIQUE INDEX "user_episode_reviews_userId_seriesTmdbId_seasonNumber_episodeNumber_key" ON "user_episode_reviews"("userId", "seriesTmdbId", "seasonNumber", "episodeNumber");
CREATE INDEX "user_episode_reviews_userId_idx" ON "user_episode_reviews"("userId");
CREATE INDEX "user_episode_reviews_seriesTmdbId_seasonNumber_idx" ON "user_episode_reviews"("seriesTmdbId", "seasonNumber");

ALTER TABLE "user_movie_reviews" ADD CONSTRAINT "user_movie_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_episode_reviews" ADD CONSTRAINT "user_episode_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
