CREATE TABLE "user_follows" (
    "id" UUID NOT NULL,
    "followerId" UUID NOT NULL,
    "followedUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_follows_no_self_follow_check" CHECK ("followerId" <> "followedUserId")
);

CREATE UNIQUE INDEX "user_follows_followerId_followedUserId_key" ON "user_follows"("followerId", "followedUserId");
CREATE INDEX "user_follows_followedUserId_idx" ON "user_follows"("followedUserId");

ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followedUserId_fkey" FOREIGN KEY ("followedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
