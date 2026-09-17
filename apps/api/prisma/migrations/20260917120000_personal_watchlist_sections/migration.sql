CREATE TABLE "personal_watchlist_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "watchlistId" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_watchlist_sections_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "personal_watchlist_items" ADD COLUMN "sectionId" UUID;

CREATE UNIQUE INDEX "personal_watchlist_sections_watchlistId_name_key"
ON "personal_watchlist_sections"("watchlistId", "name");

CREATE UNIQUE INDEX "personal_watchlist_sections_watchlistId_position_key"
ON "personal_watchlist_sections"("watchlistId", "position");

CREATE INDEX "personal_watchlist_items_sectionId_idx"
ON "personal_watchlist_items"("sectionId");

ALTER TABLE "personal_watchlist_sections"
ADD CONSTRAINT "personal_watchlist_sections_watchlistId_fkey"
FOREIGN KEY ("watchlistId") REFERENCES "personal_watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personal_watchlist_items"
ADD CONSTRAINT "personal_watchlist_items_sectionId_fkey"
FOREIGN KEY ("sectionId") REFERENCES "personal_watchlist_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
