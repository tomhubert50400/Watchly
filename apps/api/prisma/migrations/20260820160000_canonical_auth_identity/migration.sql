-- Extend the provider set used by Watchly authentication.
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'FACEBOOK';
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'DISCORD';

-- Keep the Firebase account UID separate from provider-specific subjects.
ALTER TABLE "users" ADD COLUMN "firebaseUid" VARCHAR(128);
ALTER TABLE "auth_identities" ADD COLUMN "emailNormalized" VARCHAR(320);

UPDATE "users" AS "user"
SET "firebaseUid" = "identity"."providerUserId"
FROM (
    SELECT DISTINCT ON ("userId") "userId", "providerUserId"
    FROM "auth_identities"
    ORDER BY "userId", "createdAt", "id"
) AS "identity"
WHERE "user"."id" = "identity"."userId";

UPDATE "auth_identities"
SET "emailNormalized" = LOWER(BTRIM("email"))
WHERE "email" IS NOT NULL AND BTRIM("email") <> '';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "users" WHERE "firebaseUid" IS NULL) THEN
        RAISE EXCEPTION 'Cannot assign canonical Firebase UIDs because at least one user has no auth identity.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "users"
        GROUP BY "firebaseUid"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate Firebase UIDs require manual account reconciliation before this migration.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "auth_identities"
        GROUP BY "userId", "provider"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate provider identities require manual account reconciliation before this migration.';
    END IF;
END $$;

ALTER TABLE "users" ALTER COLUMN "firebaseUid" SET NOT NULL;

CREATE UNIQUE INDEX "users_firebaseUid_key" ON "users"("firebaseUid");
CREATE UNIQUE INDEX "auth_identities_userId_provider_key" ON "auth_identities"("userId", "provider");
CREATE INDEX "auth_identities_emailNormalized_idx" ON "auth_identities"("emailNormalized");
