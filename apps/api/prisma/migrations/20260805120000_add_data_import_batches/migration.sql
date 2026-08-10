CREATE TYPE "DataImportSource" AS ENUM ('LETTERBOXD', 'IMDB');
CREATE TYPE "DataImportStatus" AS ENUM ('PREVIEWED', 'COMPLETED');

ALTER TABLE "user_movie_reviews" ALTER COLUMN "body" TYPE TEXT;
ALTER TABLE "user_episode_reviews" ALTER COLUMN "body" TYPE TEXT;

CREATE TABLE "data_imports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "source" "DataImportSource" NOT NULL,
    "status" "DataImportStatus" NOT NULL DEFAULT 'PREVIEWED',
    "fileName" VARCHAR(255) NOT NULL,
    "preview" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "data_imports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_imports_userId_createdAt_idx" ON "data_imports"("userId", "createdAt");

ALTER TABLE "data_imports"
ADD CONSTRAINT "data_imports_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
