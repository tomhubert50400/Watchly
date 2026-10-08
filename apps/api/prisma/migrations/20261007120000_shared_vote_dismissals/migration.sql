CREATE TABLE "shared_voting_dismissals" (
  "sessionId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shared_voting_dismissals_pkey" PRIMARY KEY ("sessionId", "userId"),
  CONSTRAINT "shared_voting_dismissals_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "shared_voting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shared_voting_dismissals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "shared_voting_dismissals_userId_idx" ON "shared_voting_dismissals"("userId");

UPDATE "notifications" n
SET title = LEFT('Vote result for: ' || w.name, 160),
    body = COALESCE((
      SELECT LEFT(string_agg(leader->>'title', ', ' ORDER BY position), 500)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(n."routeMetadata"->'leaders') = 'array'
        THEN n."routeMetadata"->'leaders' ELSE '[]'::jsonb END) WITH ORDINALITY AS result(leader, position)
    ), n.body)
FROM "shared_watchlists" w
WHERE n."sharedWatchlistId" = w.id AND n.kind = 'SHARED_VOTE_UPDATE'
  AND n."routeMetadata"->>'final' = 'true';

UPDATE "notifications" n
SET title = LEFT('Vote update for: ' || w.name, 160)
FROM "shared_watchlists" w
WHERE n."sharedWatchlistId" = w.id AND n.kind = 'SHARED_VOTE_UPDATE'
  AND n.title = 'Shared vote update';
