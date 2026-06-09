-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'APPLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "PrivacyVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SharedWatchlistVisibility" AS ENUM ('MEMBERS', 'PRIVATE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_settings" (
    "userId" UUID NOT NULL,
    "profileVisibility" "PrivacyVisibility" NOT NULL DEFAULT 'PUBLIC',
    "viewingHistoryVisibility" "PrivacyVisibility" NOT NULL DEFAULT 'PRIVATE',
    "episodeProgressVisibility" "PrivacyVisibility" NOT NULL DEFAULT 'PRIVATE',
    "reviewsVisibility" "PrivacyVisibility" NOT NULL DEFAULT 'PUBLIC',
    "ratingsVisibility" "PrivacyVisibility" NOT NULL DEFAULT 'PRIVATE',
    "sharedWatchlistVisibility" "SharedWatchlistVisibility" NOT NULL DEFAULT 'MEMBERS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "auth_identities_userId_idx" ON "auth_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_providerUserId_key" ON "auth_identities"("provider", "providerUserId");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
