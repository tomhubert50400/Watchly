CREATE TABLE "character_alert_subscriptions" (
    "userId" UUID NOT NULL,
    "characterKey" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "character_alert_subscriptions_pkey" PRIMARY KEY ("userId", "characterKey"),
    CONSTRAINT "character_alert_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
