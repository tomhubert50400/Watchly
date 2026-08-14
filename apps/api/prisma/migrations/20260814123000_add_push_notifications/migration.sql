CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID');
CREATE TYPE "PushDeliveryStatus" AS ENUM ('PENDING', 'TICKETED', 'DELIVERED', 'FAILED');

CREATE TABLE "notification_preferences" (
    "userId" UUID NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "releasePushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "push_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "expoPushToken" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRegisteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notificationId" UUID NOT NULL,
    "pushDeviceId" UUID NOT NULL,
    "status" "PushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "ticketId" VARCHAR(64),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "errorCode" VARCHAR(64),
    "errorMessage" VARCHAR(500),
    "sentAt" TIMESTAMP(3),
    "receiptCheckedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_devices_environment_expoPushToken_key"
ON "push_devices"("environment", "expoPushToken");
CREATE INDEX "push_devices_userId_environment_active_idx"
ON "push_devices"("userId", "environment", "active");
CREATE UNIQUE INDEX "push_deliveries_ticketId_key" ON "push_deliveries"("ticketId");
CREATE UNIQUE INDEX "push_deliveries_notificationId_pushDeviceId_key"
ON "push_deliveries"("notificationId", "pushDeviceId");
CREATE INDEX "push_deliveries_status_nextAttemptAt_idx"
ON "push_deliveries"("status", "nextAttemptAt");

ALTER TABLE "notification_preferences"
ADD CONSTRAINT "notification_preferences_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_devices"
ADD CONSTRAINT "push_devices_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_deliveries"
ADD CONSTRAINT "push_deliveries_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_deliveries"
ADD CONSTRAINT "push_deliveries_pushDeviceId_fkey"
FOREIGN KEY ("pushDeviceId") REFERENCES "push_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
