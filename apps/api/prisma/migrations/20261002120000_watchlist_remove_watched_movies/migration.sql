BEGIN;

ALTER TABLE "personal_watchlists"
ADD COLUMN "removeWatchedMovies" BOOLEAN NOT NULL DEFAULT false;

-- Apply the preference to future movie viewings, including rewatches and imports.
-- The automatic Planned list keeps its separate tracking synchronization.
CREATE FUNCTION remove_watched_watchlist_movie() RETURNS trigger AS $$
BEGIN
  IF NEW."contentType" <> 'MOVIE' THEN
    RETURN NULL;
  END IF;
  IF TG_TABLE_NAME = 'user_content_states' THEN
    IF NEW.status IS DISTINCT FROM 'WATCHED' THEN
      RETURN NULL;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
      RETURN NULL;
    END IF;
  END IF;

  WITH removed AS (
    DELETE FROM "personal_watchlist_items" item
    USING "personal_watchlists" list
    WHERE item."watchlistId" = list.id
      AND list."userId" = NEW."userId"
      AND list."systemKey" IS NULL
      AND list."removeWatchedMovies"
      AND item."contentType" = 'MOVIE'
      AND item."tmdbId" = NEW."tmdbId"
    RETURNING item."watchlistId"
  )
  UPDATE "personal_watchlists" SET "updatedAt" = CURRENT_TIMESTAMP
  WHERE id IN (SELECT "watchlistId" FROM removed);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_content_states_remove_watched_movie"
AFTER INSERT OR UPDATE OF status ON "user_content_states"
FOR EACH ROW EXECUTE FUNCTION remove_watched_watchlist_movie();

CREATE TRIGGER "viewing_events_remove_watched_movie"
AFTER INSERT ON "viewing_events"
FOR EACH ROW EXECUTE FUNCTION remove_watched_watchlist_movie();

COMMIT;
