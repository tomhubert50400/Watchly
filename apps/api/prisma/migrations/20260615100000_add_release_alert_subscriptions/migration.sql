CREATE TABLE "release_alert_subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "contentType" "TrackedContentType" NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_alert_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "release_alert_subscriptions_userId_contentType_tmdbId_key" ON "release_alert_subscriptions"("userId", "contentType", "tmdbId");
CREATE INDEX "release_alert_subscriptions_contentType_tmdbId_idx" ON "release_alert_subscriptions"("contentType", "tmdbId");

ALTER TABLE "release_alert_subscriptions" ADD CONSTRAINT "release_alert_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
