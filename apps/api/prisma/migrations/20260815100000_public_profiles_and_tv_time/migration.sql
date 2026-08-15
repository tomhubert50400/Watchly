ALTER TYPE "DataImportSource" ADD VALUE 'TV_TIME';

ALTER TABLE "privacy_settings"
  ALTER COLUMN "profileVisibility" SET DEFAULT 'PUBLIC',
  ALTER COLUMN "viewingHistoryVisibility" SET DEFAULT 'PUBLIC',
  ALTER COLUMN "episodeProgressVisibility" SET DEFAULT 'PUBLIC',
  ALTER COLUMN "reviewsVisibility" SET DEFAULT 'PUBLIC',
  ALTER COLUMN "ratingsVisibility" SET DEFAULT 'PUBLIC';
