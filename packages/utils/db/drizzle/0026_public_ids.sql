ALTER TABLE "users" ADD COLUMN "public_id" text;
--> statement-breakpoint
UPDATE "users" SET "public_id" = gen_random_uuid()::text WHERE "public_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "public_id" SET DEFAULT gen_random_uuid()::text;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "public_id" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "users_public_id_unique" ON "users" ("public_id");
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "public_id" text;
--> statement-breakpoint
UPDATE "posts" SET "public_id" = gen_random_uuid()::text WHERE "public_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "public_id" SET DEFAULT gen_random_uuid()::text;
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "public_id" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "posts_public_id_unique" ON "posts" ("public_id");
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "public_id" text;
--> statement-breakpoint
UPDATE "groups" SET "public_id" = gen_random_uuid()::text WHERE "public_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "public_id" SET DEFAULT gen_random_uuid()::text;
--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "public_id" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "groups_public_id_unique" ON "groups" ("public_id");
--> statement-breakpoint
ALTER TABLE "collaboration_rooms" ADD COLUMN "public_id" text;
--> statement-breakpoint
UPDATE "collaboration_rooms" SET "public_id" = gen_random_uuid()::text WHERE "public_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "collaboration_rooms" ALTER COLUMN "public_id" SET DEFAULT gen_random_uuid()::text;
--> statement-breakpoint
ALTER TABLE "collaboration_rooms" ALTER COLUMN "public_id" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "collaboration_rooms_public_id_unique" ON "collaboration_rooms" ("public_id");
