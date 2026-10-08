CREATE TABLE "login_email_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"auth_version" integer NOT NULL,
	"code_hash" text NOT NULL,
	"nonce" text NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"country" text,
	"timezone" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_email_challenges" ADD CONSTRAINT "login_email_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_login_email_challenges_user_expiry" ON "login_email_challenges" USING btree ("user_id", "expires_at");