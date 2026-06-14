CREATE TABLE "personal_watchlists" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_watchlists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "personal_watchlist_items" (
    "id" UUID NOT NULL,
    "watchlistId" UUID NOT NULL,
    "contentType" "TrackedContentType" NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_watchlist_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "personal_watchlists_userId_idx" ON "personal_watchlists"("userId");

CREATE UNIQUE INDEX "personal_watchlist_items_watchlistId_contentType_tmdbId_key"
    ON "personal_watchlist_items"("watchlistId", "contentType", "tmdbId");

CREATE INDEX "personal_watchlist_items_contentType_tmdbId_idx"
    ON "personal_watchlist_items"("contentType", "tmdbId");

ALTER TABLE "personal_watchlists"
    ADD CONSTRAINT "personal_watchlists_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personal_watchlist_items"
    ADD CONSTRAINT "personal_watchlist_items_watchlistId_fkey"
    FOREIGN KEY ("watchlistId") REFERENCES "personal_watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
