ALTER TABLE "users"
ADD COLUMN "profileBackdropContentType" "TrackedContentType",
ADD COLUMN "profileBackdropTmdbId" INTEGER;

ALTER TABLE "users"
ADD CONSTRAINT "users_profile_backdrop_selection_check"
CHECK (
  ("profileBackdropContentType" IS NULL AND "profileBackdropTmdbId" IS NULL)
  OR
  ("profileBackdropContentType" IS NOT NULL AND "profileBackdropTmdbId" > 0)
);
