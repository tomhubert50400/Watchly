ALTER TABLE "user_movie_ratings" DROP CONSTRAINT "user_movie_ratings_score_check";

ALTER TABLE "user_movie_ratings" RENAME COLUMN "score" TO "scoreHalfSteps";

UPDATE "user_movie_ratings"
SET "scoreHalfSteps" = "scoreHalfSteps" * 2;

ALTER TABLE "user_movie_ratings" ADD CONSTRAINT "user_movie_ratings_scoreHalfSteps_check" CHECK ("scoreHalfSteps" >= 1 AND "scoreHalfSteps" <= 10);
