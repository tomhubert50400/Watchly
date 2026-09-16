ALTER TABLE "personal_watchlists" ADD COLUMN "coverItemIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
ALTER TABLE "shared_watchlists" ADD COLUMN "coverItemIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
