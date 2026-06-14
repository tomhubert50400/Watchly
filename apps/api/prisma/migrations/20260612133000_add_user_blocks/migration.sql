CREATE TABLE "user_blocks" (
    "id" UUID NOT NULL,
    "blockerId" UUID NOT NULL,
    "blockedUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_blocks_no_self_block_check" CHECK ("blockerId" <> "blockedUserId")
);

CREATE UNIQUE INDEX "user_blocks_blockerId_blockedUserId_key" ON "user_blocks"("blockerId", "blockedUserId");
CREATE INDEX "user_blocks_blockedUserId_idx" ON "user_blocks"("blockedUserId");

ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
