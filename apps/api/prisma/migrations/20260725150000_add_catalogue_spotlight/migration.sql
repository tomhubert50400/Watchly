CREATE TABLE "catalogue_spotlights" (
    "id" VARCHAR(32) NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "posterUrl" TEXT,
    "backdropUrl" TEXT NOT NULL,
    "releaseDate" VARCHAR(10),
    "voteAverage" DOUBLE PRECISION,
    "selectedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogue_spotlights_pkey" PRIMARY KEY ("id")
);
