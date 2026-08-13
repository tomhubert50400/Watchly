ALTER TYPE "AdminAuditAction" ADD VALUE 'USER_SUSPENDED';
ALTER TYPE "AdminAuditAction" ADD VALUE 'USER_REACTIVATED';
ALTER TYPE "AdminAuditAction" ADD VALUE 'CONTENT_HIDDEN';
ALTER TYPE "AdminAuditAction" ADD VALUE 'CONTENT_RESTORED';

ALTER TABLE "users" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "user_movie_reviews" ADD COLUMN "moderationHiddenAt" TIMESTAMP(3);
ALTER TABLE "user_episode_reviews" ADD COLUMN "moderationHiddenAt" TIMESTAMP(3);
