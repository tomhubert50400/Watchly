CREATE TABLE "user_series_ratings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "seriesTmdbId" INTEGER NOT NULL,
    "scoreHalfSteps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_series_ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_series_ratings_userId_seriesTmdbId_key"
ON "user_series_ratings"("userId", "seriesTmdbId");

CREATE INDEX "user_series_ratings_userId_idx" ON "user_series_ratings"("userId");
CREATE INDEX "user_series_ratings_seriesTmdbId_idx" ON "user_series_ratings"("seriesTmdbId");

ALTER TABLE "user_series_ratings"
ADD CONSTRAINT "user_series_ratings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
