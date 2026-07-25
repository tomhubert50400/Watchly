CREATE TYPE "FollowStatus" AS ENUM ('PENDING', 'ACCEPTED');

ALTER TABLE "user_follows"
ADD COLUMN "status" "FollowStatus" NOT NULL DEFAULT 'ACCEPTED';

CREATE INDEX "user_follows_followedUserId_status_idx"
ON "user_follows"("followedUserId", "status");
