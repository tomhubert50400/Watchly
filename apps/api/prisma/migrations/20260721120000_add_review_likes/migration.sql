CREATE TABLE "movie_review_likes" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movie_review_likes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "episode_review_likes" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "episode_review_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "movie_review_likes_userId_reviewId_key" ON "movie_review_likes"("userId", "reviewId");
CREATE INDEX "movie_review_likes_reviewId_idx" ON "movie_review_likes"("reviewId");
CREATE UNIQUE INDEX "episode_review_likes_userId_reviewId_key" ON "episode_review_likes"("userId", "reviewId");
CREATE INDEX "episode_review_likes_reviewId_idx" ON "episode_review_likes"("reviewId");

ALTER TABLE "movie_review_likes" ADD CONSTRAINT "movie_review_likes_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "user_movie_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movie_review_likes" ADD CONSTRAINT "movie_review_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "episode_review_likes" ADD CONSTRAINT "episode_review_likes_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "user_episode_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "episode_review_likes" ADD CONSTRAINT "episode_review_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
