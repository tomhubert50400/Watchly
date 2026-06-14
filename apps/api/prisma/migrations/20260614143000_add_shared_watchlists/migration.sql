CREATE TABLE "shared_watchlists" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "shared_watchlists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shared_watchlist_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "watchlistId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shared_watchlist_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shared_watchlist_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "watchlistId" UUID NOT NULL,
  "contentType" "TrackedContentType" NOT NULL,
  "tmdbId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shared_watchlist_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shared_voting_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "watchlistId" UUID NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "shared_voting_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shared_voting_candidates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sessionId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shared_voting_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shared_voting_votes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "candidateId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shared_voting_votes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shared_watchlists_ownerId_idx" ON "shared_watchlists"("ownerId");
CREATE UNIQUE INDEX "shared_watchlist_members_watchlistId_userId_key" ON "shared_watchlist_members"("watchlistId", "userId");
CREATE INDEX "shared_watchlist_members_userId_idx" ON "shared_watchlist_members"("userId");
CREATE UNIQUE INDEX "shared_watchlist_items_watchlistId_contentType_tmdbId_key" ON "shared_watchlist_items"("watchlistId", "contentType", "tmdbId");
CREATE INDEX "shared_watchlist_items_contentType_tmdbId_idx" ON "shared_watchlist_items"("contentType", "tmdbId");
CREATE INDEX "shared_voting_sessions_watchlistId_idx" ON "shared_voting_sessions"("watchlistId");
CREATE UNIQUE INDEX "shared_voting_candidates_sessionId_itemId_key" ON "shared_voting_candidates"("sessionId", "itemId");
CREATE INDEX "shared_voting_candidates_itemId_idx" ON "shared_voting_candidates"("itemId");
CREATE UNIQUE INDEX "shared_voting_votes_candidateId_userId_key" ON "shared_voting_votes"("candidateId", "userId");
CREATE INDEX "shared_voting_votes_userId_idx" ON "shared_voting_votes"("userId");

ALTER TABLE "shared_watchlists" ADD CONSTRAINT "shared_watchlists_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shared_watchlist_members" ADD CONSTRAINT "shared_watchlist_members_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "shared_watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shared_watchlist_members" ADD CONSTRAINT "shared_watchlist_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shared_watchlist_items" ADD CONSTRAINT "shared_watchlist_items_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "shared_watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shared_voting_sessions" ADD CONSTRAINT "shared_voting_sessions_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "shared_watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shared_voting_candidates" ADD CONSTRAINT "shared_voting_candidates_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "shared_voting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shared_voting_candidates" ADD CONSTRAINT "shared_voting_candidates_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "shared_watchlist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shared_voting_votes" ADD CONSTRAINT "shared_voting_votes_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "shared_voting_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shared_voting_votes" ADD CONSTRAINT "shared_voting_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
