CREATE TABLE "waitlist_subscribers" (
    "id" UUID NOT NULL,
    "emailNormalized" VARCHAR(320) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_subscribers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "waitlist_subscribers_emailNormalized_key"
ON "waitlist_subscribers"("emailNormalized");
