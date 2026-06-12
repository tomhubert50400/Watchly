CREATE TABLE "user_movie_ratings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_movie_ratings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_movie_ratings_score_check" CHECK ("score" >= 1 AND "score" <= 5)
);

CREATE UNIQUE INDEX "user_movie_ratings_userId_tmdbId_key" ON "user_movie_ratings"("userId", "tmdbId");
CREATE INDEX "user_movie_ratings_userId_idx" ON "user_movie_ratings"("userId");
CREATE INDEX "user_movie_ratings_tmdbId_idx" ON "user_movie_ratings"("tmdbId");

ALTER TABLE "user_movie_ratings" ADD CONSTRAINT "user_movie_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
