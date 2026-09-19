ALTER TYPE "ReportTargetType" ADD VALUE 'REVIEW_REPLY';
ALTER TYPE "NotificationKind" ADD VALUE 'REVIEW_REPLY';

CREATE TABLE "review_replies" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "movieReviewId" UUID,
    "episodeReviewId" UUID,
    "body" VARCHAR(1000) NOT NULL,
    "containsSpoilers" BOOLEAN NOT NULL DEFAULT false,
    "moderationHiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "review_replies_exactly_one_review_check" CHECK (
        ("movieReviewId" IS NOT NULL AND "episodeReviewId" IS NULL) OR
        ("movieReviewId" IS NULL AND "episodeReviewId" IS NOT NULL)
    )
);

CREATE INDEX "review_replies_movieReviewId_createdAt_idx" ON "review_replies"("movieReviewId", "createdAt");
CREATE INDEX "review_replies_episodeReviewId_createdAt_idx" ON "review_replies"("episodeReviewId", "createdAt");
CREATE INDEX "review_replies_userId_idx" ON "review_replies"("userId");

ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_movieReviewId_fkey" FOREIGN KEY ("movieReviewId") REFERENCES "user_movie_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_episodeReviewId_fkey" FOREIGN KEY ("episodeReviewId") REFERENCES "user_episode_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
