ALTER TABLE "users" ADD COLUMN "handle" VARCHAR(20);

CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");
