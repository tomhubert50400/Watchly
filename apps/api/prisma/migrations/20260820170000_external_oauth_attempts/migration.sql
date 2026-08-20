CREATE TABLE "oauth_attempts" (
    "id" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "stateHash" VARCHAR(64) NOT NULL,
    "completionHash" VARCHAR(64),
    "appRedirectUri" VARCHAR(512) NOT NULL,
    "initiatedByFirebaseUid" VARCHAR(128),
    "providerUserId" TEXT,
    "email" VARCHAR(320),
    "emailVerified" BOOLEAN,
    "displayName" TEXT,
    "photoUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_attempts_stateHash_key" ON "oauth_attempts"("stateHash");
CREATE UNIQUE INDEX "oauth_attempts_completionHash_key" ON "oauth_attempts"("completionHash");
CREATE INDEX "oauth_attempts_expiresAt_idx" ON "oauth_attempts"("expiresAt");
