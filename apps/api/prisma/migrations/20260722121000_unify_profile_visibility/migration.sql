UPDATE "privacy_settings"
SET
  "profileVisibility" = 'PRIVATE',
  "viewingHistoryVisibility" = 'PRIVATE',
  "episodeProgressVisibility" = 'PRIVATE',
  "reviewsVisibility" = 'PRIVATE',
  "ratingsVisibility" = 'PRIVATE'
WHERE
  "profileVisibility" = 'PRIVATE'
  OR "viewingHistoryVisibility" = 'PRIVATE'
  OR "episodeProgressVisibility" = 'PRIVATE'
  OR "reviewsVisibility" = 'PRIVATE'
  OR "ratingsVisibility" = 'PRIVATE';

ALTER TABLE "privacy_settings"
ALTER COLUMN "profileVisibility" SET DEFAULT 'PRIVATE',
ALTER COLUMN "reviewsVisibility" SET DEFAULT 'PRIVATE';
