ALTER TABLE "review_replies"
ADD COLUMN "parentReplyId" UUID;

CREATE INDEX "review_replies_parentReplyId_createdAt_idx"
ON "review_replies"("parentReplyId", "createdAt");

ALTER TABLE "review_replies"
ADD CONSTRAINT "review_replies_parentReplyId_fkey"
FOREIGN KEY ("parentReplyId") REFERENCES "review_replies"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
