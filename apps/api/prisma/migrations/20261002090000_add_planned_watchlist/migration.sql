BEGIN;

LOCK TABLE "user_content_states" IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "personal_watchlists" ADD COLUMN "systemKey" TEXT;

CREATE UNIQUE INDEX "personal_watchlists_userId_systemKey_key"
ON "personal_watchlists"("userId", "systemKey");

-- Keep Planned membership atomic for tracking, viewing history, and imports.
CREATE FUNCTION sync_planned_watchlist() RETURNS trigger AS $$
DECLARE
  planned_list_id UUID;
BEGIN
  IF TG_OP <> 'DELETE' AND NEW.status = 'WATCHLISTED' THEN
    INSERT INTO "personal_watchlists" (id, "userId", name, "systemKey", "updatedAt")
    VALUES (gen_random_uuid(), NEW."userId", 'Planned to Watch', 'planned', CURRENT_TIMESTAMP)
    ON CONFLICT ("userId", "systemKey") DO UPDATE
      SET "updatedAt" = CURRENT_TIMESTAMP
    RETURNING id INTO planned_list_id;

    INSERT INTO "personal_watchlist_items" (id, "watchlistId", "contentType", "tmdbId", "createdAt")
    VALUES (gen_random_uuid(), planned_list_id, NEW."contentType", NEW."tmdbId", NEW."updatedAt")
    ON CONFLICT ("watchlistId", "contentType", "tmdbId") DO NOTHING;
  ELSIF TG_OP <> 'INSERT' AND OLD.status = 'WATCHLISTED' THEN
    SELECT id INTO planned_list_id FROM "personal_watchlists"
    WHERE "userId" = OLD."userId" AND "systemKey" = 'planned'
    FOR UPDATE;

    DELETE FROM "personal_watchlist_items"
    WHERE "watchlistId" = planned_list_id
      AND "contentType" = OLD."contentType" AND "tmdbId" = OLD."tmdbId";

    UPDATE "personal_watchlists" SET "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = planned_list_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_content_states_sync_planned"
AFTER INSERT OR UPDATE OF status OR DELETE ON "user_content_states"
FOR EACH ROW EXECUTE FUNCTION sync_planned_watchlist();

-- Existing Planned titles get their own private list without claiming a user's named list.
INSERT INTO "personal_watchlists" (id, "userId", name, "systemKey", "updatedAt")
SELECT gen_random_uuid(), "userId", 'Planned to Watch', 'planned', MAX("updatedAt")
FROM "user_content_states" WHERE status = 'WATCHLISTED' GROUP BY "userId";

INSERT INTO "personal_watchlist_items" (id, "watchlistId", "contentType", "tmdbId", "createdAt")
SELECT gen_random_uuid(), list.id, state."contentType", state."tmdbId", state."updatedAt"
FROM "user_content_states" state
JOIN "personal_watchlists" list ON list."userId" = state."userId" AND list."systemKey" = 'planned'
WHERE state.status = 'WATCHLISTED';

COMMIT;
