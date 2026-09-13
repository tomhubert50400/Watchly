ALTER TABLE "privacy_settings" ALTER COLUMN "viewingHistoryVisibility" SET DEFAULT 'PRIVATE';
UPDATE "privacy_settings" SET "viewingHistoryVisibility" = 'PRIVATE';
