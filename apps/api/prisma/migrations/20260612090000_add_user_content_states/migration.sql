-- CreateEnum
CREATE TYPE "TrackedContentType" AS ENUM ('MOVIE', 'SERIES');

-- CreateEnum
CREATE TYPE "UserContentStatus" AS ENUM ('WATCHLISTED', 'WATCHING', 'WATCHED', 'DROPPED');

-- CreateTable
CREATE TABLE "user_content_states" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "contentType" "TrackedContentType" NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "status" "UserContentStatus",
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_content_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_content_states_userId_idx" ON "user_content_states"("userId");

-- CreateIndex
CREATE INDEX "user_content_states_contentType_tmdbId_idx" ON "user_content_states"("contentType", "tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "user_content_states_userId_contentType_tmdbId_key" ON "user_content_states"("userId", "contentType", "tmdbId");

-- AddForeignKey
ALTER TABLE "user_content_states" ADD CONSTRAINT "user_content_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
