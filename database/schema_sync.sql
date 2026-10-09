-- Generated from packages/utils/db/src/schema/*.ts by scripts/sql/generate-schema-sync.mjs.
-- Refresh with: pnpm project:snapshot
-- Additive only: this file creates missing objects and never removes or rewrites data.
-- For existing tables, required columns without defaults are added nullable to preserve existing rows.
-- Unique indexes that conflict with existing duplicate values are skipped with a NOTICE.
-- Foreign keys are validated on empty tables and added NOT VALID on populated tables, preserving old data.
-- Existing column types/defaults and invalid historical foreign-key rows are not rewritten or repaired.

BEGIN;

CREATE TABLE IF NOT EXISTS "blocked_email_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"domain" text NOT NULL,
	"reason" text NOT NULL,
	"reputation_score" integer NOT NULL,
	"ip_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "education_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"school" text NOT NULL,
	"degree" text NOT NULL,
	"field" text,
	"start_year" integer NOT NULL,
	"end_year" integer,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" integer NOT NULL,
	"following_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "login_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"country" text,
	"timezone" text,
	"integrity_status" text DEFAULT 'normal' NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "revoked_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "revoked_tokens_token_hash_unique" UNIQUE("token_hash")
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text DEFAULT gen_random_uuid()::text NOT NULL,
	"username" text NOT NULL,
	"last_username_change_at" timestamp,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"auth_version" integer DEFAULT 0 NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"headline" text,
	"avatar_url" text,
	"cover_url" text,
	"website" text,
	"location" text,
	"country" text,
	"facebook" text,
	"linkedin" text,
	"twitter" text,
	"instagram" text,
	"profile_visibility" text DEFAULT 'public' NOT NULL,
	"show_email" boolean DEFAULT false NOT NULL,
	"show_website" boolean DEFAULT true NOT NULL,
	"show_location" boolean DEFAULT true NOT NULL,
	"show_posts_to_everyone" boolean DEFAULT true NOT NULL,
	"allow_messages_from_anyone" boolean DEFAULT false NOT NULL,
	"show_in_search" boolean DEFAULT true NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured_until" timestamp,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"onboarding_goals" text,
	"identity_type" text,
	"signup_ip_hash" text,
	"signup_user_agent" text,
	"last_known_ip_hash" text,
	"last_known_country" text,
	"last_known_timezone" text,
	"location_integrity_status" text DEFAULT 'unknown' NOT NULL,
	"location_risk_score" integer DEFAULT 0 NOT NULL,
	"is_creator_mode" boolean DEFAULT false NOT NULL,
	"visibility_penalty" real DEFAULT 0 NOT NULL,
	"reach_multiplier" real DEFAULT 1 NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"is_official_account" boolean DEFAULT false NOT NULL,
	"hire_me_enabled" boolean DEFAULT false NOT NULL,
	"email_digest_enabled" boolean DEFAULT true NOT NULL,
	"topic_notification_enabled" boolean DEFAULT true NOT NULL,
	"notification_prefs" jsonb,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret" text,
	"password_reset_token_hash" text,
	"password_reset_expires" timestamp,
	"referral_source" text,
	"referred_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "work_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"organization" text NOT NULL,
	"start_year" integer NOT NULL,
	"end_year" integer,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comment_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"content" text NOT NULL,
	"parent_comment_id" integer,
	"depth" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer,
	"source" text,
	"click_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text DEFAULT gen_random_uuid()::text NOT NULL,
	"author_id" integer NOT NULL,
	"title" text,
	"title_a" text,
	"title_b" text,
	"title_a_clicks" integer DEFAULT 0 NOT NULL,
	"title_b_clicks" integer DEFAULT 0 NOT NULL,
	"ab_selected_title" text,
	"ab_locked_at" timestamp,
	"content" text NOT NULL,
	"excerpt" text,
	"type" text DEFAULT 'post' NOT NULL,
	"image_url" text,
	"external_url" text,
	"attachments" text DEFAULT '[]' NOT NULL,
	"tags" text DEFAULT '[]' NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"scheduled_at" timestamp,
	"expires_at" timestamp,
	"viewed_by" jsonb DEFAULT '[]'::jsonb,
	"is_highlight" boolean DEFAULT false NOT NULL,
	"content_warning" text,
	"content_tags" text DEFAULT '[]' NOT NULL,
	"ai_text_score" real,
	"fingerprint" text,
	"series_id" integer,
	"series_order" integer,
	"group_id" integer,
	"share_click_count" integer DEFAULT 0 NOT NULL,
	"edited_count" integer DEFAULT 0 NOT NULL,
	"is_sponsored" boolean DEFAULT false NOT NULL,
	"sponsor_name" text,
	"sponsor_logo_url" text,
	"sponsor_url" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"is_official_post" boolean DEFAULT false NOT NULL,
	"post_category" text,
	"official_post_priority" integer DEFAULT 0 NOT NULL,
	"cta_buttons" jsonb,
	"official_target_audience" text,
	"official_language" text,
	"challenge_hashtag" text,
	"challenge_ends_at" timestamp,
	"challenge_reward_text" text,
	"featured_creator_id" integer,
	"quoted_post_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reposts" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "saved_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversation_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"is_group" boolean DEFAULT false NOT NULL,
	"group_name" text,
	"opportunity_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"seen_at" timestamp
);

CREATE TABLE IF NOT EXISTS "conversation_payment_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"proposer_id" integer NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"note" text,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"actor_id" integer,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_bans" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"banned_by" integer NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"invited_by_user_id" integer NOT NULL,
	"invite_code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_join_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"screening_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"muted_until" timestamp,
	"trust_score_at_join" integer
);

CREATE TABLE IF NOT EXISTS "group_pinned_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"pinned_by" integer NOT NULL,
	"pinned_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_post_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"type" text DEFAULT 'discussion' NOT NULL,
	"poll" jsonb,
	"question" jsonb,
	"opportunity_id" integer,
	"opportunity_snapshot" jsonb,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_announcement" boolean DEFAULT false NOT NULL,
	"comments_enabled" boolean DEFAULT true NOT NULL,
	"approval_status" text DEFAULT 'approved' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text DEFAULT gen_random_uuid()::text NOT NULL,
	"slug" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon_image" text,
	"cover_image" text,
	"avatar_url" text,
	"cover_url" text,
	"category" text DEFAULT 'general' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"creator_id" integer NOT NULL,
	"privacy" text DEFAULT 'open' NOT NULL,
	"type" text DEFAULT 'public' NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_announcement_only" boolean DEFAULT false NOT NULL,
	"require_approval_first_three" boolean DEFAULT false NOT NULL,
	"require_approval_all" boolean DEFAULT false NOT NULL,
	"announcement_policy" text DEFAULT 'admins' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"features" jsonb DEFAULT '{"eventsEnabled":false}'::jsonb NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_promoted" boolean DEFAULT false NOT NULL,
	"promoted_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" text DEFAULT 'job' NOT NULL,
	"skills" text DEFAULT '[]' NOT NULL,
	"compensation" text,
	"remote" boolean DEFAULT true NOT NULL,
	"location" text,
	"is_paid" boolean DEFAULT false NOT NULL,
	"budget" real,
	"company_name" text,
	"apply_url" text,
	"apply_email" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"moderation_status" text DEFAULT 'published' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured_until" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "opportunity_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"applicant_id" integer NOT NULL,
	"message" text,
	"proposed_budget" real,
	"proposed_currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"conversation_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"actor_id" integer NOT NULL,
	"post_id" integer,
	"group_id" integer,
	"message" text NOT NULL,
	"title" text,
	"group_count" integer DEFAULT 1,
	"is_read" boolean DEFAULT false NOT NULL,
	"category" text DEFAULT 'social' NOT NULL,
	"digest_group" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "appreciations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "moderation_strikes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"report_id" integer,
	"reason" text NOT NULL,
	"severity" integer DEFAULT 1 NOT NULL,
	"issued_by" integer,
	"expires_at" timestamp,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" integer NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"reason" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);

CREATE TABLE IF NOT EXISTS "admin_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "portfolio_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"media_url" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "creator_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"skills" text DEFAULT '[]' NOT NULL,
	"links" text DEFAULT '[]' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"is_available_for_hire" boolean DEFAULT false NOT NULL,
	"available_for" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_profiles_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "collaboration_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "collaboration_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text DEFAULT gen_random_uuid()::text NOT NULL,
	"request_id" integer NOT NULL,
	"created_by_id" integer NOT NULL,
	"title" text NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"split_suggestion" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);

CREATE TABLE IF NOT EXISTS "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'Award' NOT NULL,
	"category" text DEFAULT 'milestone' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"achievement_id" integer NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "writing_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"write_date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "writing_streaks" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_write_date" text,
	"total_days_written" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"viewer_id" integer,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"country" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "uploaded_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer,
	"original_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"moderation_status" text DEFAULT 'approved' NOT NULL,
	"thumbnail_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "safety_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"muted_words" text DEFAULT '[]' NOT NULL,
	"blocked_user_ids" text DEFAULT '[]' NOT NULL,
	"content_filter" text DEFAULT 'standard' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "support_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"file_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"severity" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "behavior_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"severity" integer DEFAULT 1 NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_trust_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"retention_score" real DEFAULT 0 NOT NULL,
	"save_rate" real DEFAULT 0 NOT NULL,
	"deep_engagement_rate" real DEFAULT 0 NOT NULL,
	"thought_spread" real DEFAULT 0 NOT NULL,
	"cis_score" real DEFAULT 0 NOT NULL,
	"longevity_score" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_trust_scores_post_id_unique" UNIQUE("post_id")
);

CREATE TABLE IF NOT EXISTS "reputation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"score_change" real DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_trust_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"cvs" real DEFAULT 0 NOT NULL,
	"bcs" real DEFAULT 0 NOT NULL,
	"cts" real DEFAULT 0 NOT NULL,
	"avg_cis" real DEFAULT 0 NOT NULL,
	"uti" real DEFAULT 0 NOT NULL,
	"visibility_multiplier" real DEFAULT 0.3 NOT NULL,
	"tier" text DEFAULT 'restricted' NOT NULL,
	"creator_level" text DEFAULT 'new_voice' NOT NULL,
	"level_updated_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_trust_scores_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "post_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_topics_post_id_topic_id_unique" UNIQUE("post_id","topic_id")
);

CREATE TABLE IF NOT EXISTS "topic_follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topic_follows_user_id_topic_id_unique" UNIQUE("user_id","topic_id")
);

CREATE TABLE IF NOT EXISTS "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon_name" text,
	"post_count" integer DEFAULT 0 NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topics_name_unique" UNIQUE("name"),
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "mentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer,
	"mentioned_user_id" integer NOT NULL,
	"mentioning_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "translation_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_hash" text NOT NULL,
	"source_lang" text DEFAULT 'en' NOT NULL,
	"target_lang" text NOT NULL,
	"translated_text" text NOT NULL,
	"hit_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "series" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_image" text,
	"slug" text NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "collection_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_posts_collection_id_post_id_unique" UNIQUE("collection_id","post_id")
);

CREATE TABLE IF NOT EXISTS "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "income_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"source" text NOT NULL,
	"description" text,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"editor_id" integer NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"excerpt" text,
	"change_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reading_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"percent" real DEFAULT 0 NOT NULL,
	"read_time_ms" integer DEFAULT 0 NOT NULL,
	"last_read_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "poll_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "poll_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "polls" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"question" text NOT NULL,
	"allow_multiple" boolean DEFAULT false NOT NULL,
	"closes_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "post_fingerprints" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"shingle" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reading_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"read_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reading_streaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_read_date" date,
	"total_days_read" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "moderation_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trigger_type" text NOT NULL,
	"threshold_value" real NOT NULL,
	"window_minutes" integer DEFAULT 60 NOT NULL,
	"action" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"note" text NOT NULL,
	"is_internal" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"scopes" text DEFAULT '[]' NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhook_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"response_status" integer,
	"response_body" text,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"succeeded" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" text DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_delivery_at" timestamp,
	"last_success_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "invite_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_by" integer NOT NULL,
	"used_by" integer,
	"used_at" timestamp,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "featured_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"slot_key" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"title" text,
	"description" text,
	"image_url" text,
	"link_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_by" integer,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "featured_slots_slot_key_unique" UNIQUE("slot_key")
);

CREATE TABLE IF NOT EXISTS "login_email_challenges" (
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

CREATE TABLE IF NOT EXISTS "magic_link_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "oauth_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"email" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "passkeys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text,
	"device_name" text,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "passkeys_credential_id_unique" UNIQUE("credential_id")
);

CREATE TABLE IF NOT EXISTS "challenge_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'open' NOT NULL,
	"word_limit" integer,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_by" integer NOT NULL,
	"submission_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "boost_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"plan" text NOT NULL,
	"duration_hours" integer NOT NULL,
	"reach_multiplier" real DEFAULT 1 NOT NULL,
	"placement_priority" integer DEFAULT 0 NOT NULL,
	"targeting" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"granted_by_admin_id" integer,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"boost_starts_at" timestamp,
	"boost_ends_at" timestamp,
	"stripe_session_id" text,
	"flw_tx_ref" text,
	"flw_transaction_id" text,
	"paid_amount_cents" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "commission_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_creator_id" integer NOT NULL,
	"service_listing_id" integer,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"budget" real,
	"currency" text DEFAULT 'USD' NOT NULL,
	"deadline" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"creator_response" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "creator_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"available_for" text DEFAULT '[]' NOT NULL,
	"hours_per_week" integer,
	"rate_per_hour" real,
	"currency" text DEFAULT 'USD' NOT NULL,
	"timezone" text,
	"public_note" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_availability_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "creator_earnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer NOT NULL,
	"source" text NOT NULL,
	"source_id" integer,
	"gross_amount" real NOT NULL,
	"platform_fee" real DEFAULT 0 NOT NULL,
	"net_amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "creator_payment_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_id" integer NOT NULL,
	"creator_id" integer NOT NULL,
	"service_listing_id" integer NOT NULL,
	"commission_request_id" integer,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"tx_ref" text NOT NULL,
	"transaction_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	CONSTRAINT "creator_payment_transactions_tx_ref_unique" UNIQUE("tx_ref"),
	CONSTRAINT "creator_payment_transactions_transaction_id_unique" UNIQUE("transaction_id")
);

CREATE TABLE IF NOT EXISTS "creator_subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_monthly" real DEFAULT 0 NOT NULL,
	"price_yearly" real,
	"currency" text DEFAULT 'USD' NOT NULL,
	"perks" text DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "creator_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscriber_id" integer NOT NULL,
	"creator_id" integer NOT NULL,
	"plan_id" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"renews_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "creator_tips" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" integer,
	"to_creator_id" integer NOT NULL,
	"post_id" integer,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "paid_post_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);

CREATE TABLE IF NOT EXISTS "service_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"deliverables" text DEFAULT '[]' NOT NULL,
	"pricing_model" text DEFAULT 'fixed' NOT NULL,
	"price_from" real,
	"price_to" real,
	"currency" text DEFAULT 'USD' NOT NULL,
	"delivery_days" integer,
	"portfolio_urls" text DEFAULT '[]' NOT NULL,
	"skills" text DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"inquiry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "skill_endorsements" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_user_id" integer NOT NULL,
	"skill" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "creator_similarity" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_a_id" integer NOT NULL,
	"creator_b_id" integer NOT NULL,
	"similarity_score" real DEFAULT 0 NOT NULL,
	"shared_topic_ids" text DEFAULT '[]' NOT NULL,
	"audience_overlap" real DEFAULT 0 NOT NULL,
	"style_score" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_creator_affinity" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"creator_id" integer NOT NULL,
	"read_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"save_count" integer DEFAULT 0 NOT NULL,
	"affinity_score" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_taste_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"top_topic_ids" text DEFAULT '[]' NOT NULL,
	"preferred_content_types" text DEFAULT '[]' NOT NULL,
	"avg_read_depth" real DEFAULT 0 NOT NULL,
	"avg_session_length" integer DEFAULT 0 NOT NULL,
	"creator_affinities" text DEFAULT '{}' NOT NULL,
	"diversity_score" real DEFAULT 0.5 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_taste_profiles_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "user_topic_affinity" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"read_depth_total" real DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"save_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"affinity_score" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "library_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"author_id" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text,
	"category" text DEFAULT 'open_reference' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_type" text DEFAULT 'article' NOT NULL,
	"media_url" text,
	"thumbnail_url" text,
	"external_url" text,
	"license" text DEFAULT 'cc_by' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"save_count" integer DEFAULT 0 NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"schema_type" text DEFAULT 'Article' NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "library_entries_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "library_saves" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "chain_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"position" integer NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "chains" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"creator_id" integer NOT NULL,
	"prompt" text,
	"max_entries" integer DEFAULT 10,
	"is_complete" boolean DEFAULT false,
	"is_public" boolean DEFAULT true,
	"cover_image" text,
	"category" text,
	"total_views" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "profile_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_user_id" integer NOT NULL,
	"viewer_user_id" integer,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "muted_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "muted_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"muter_id" integer NOT NULL,
	"muted_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "muted_users_muter_id_muted_id_unique" UNIQUE("muter_id","muted_id")
);

CREATE TABLE IF NOT EXISTS "spam_review_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"rule_key" text NOT NULL,
	"reason" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decision" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('blocked_email_attempts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "blocked_email_attempts" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: blocked_email_attempts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on blocked_email_attempts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('blocked_email_attempts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "blocked_email_attempts" ADD COLUMN IF NOT EXISTS "email" text;
  ELSE
    RAISE NOTICE 'Skipped column email: blocked_email_attempts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column email on blocked_email_attempts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('blocked_email_attempts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "blocked_email_attempts" ADD COLUMN IF NOT EXISTS "domain" text;
  ELSE
    RAISE NOTICE 'Skipped column domain: blocked_email_attempts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column domain on blocked_email_attempts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('blocked_email_attempts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "blocked_email_attempts" ADD COLUMN IF NOT EXISTS "reason" text;
  ELSE
    RAISE NOTICE 'Skipped column reason: blocked_email_attempts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reason on blocked_email_attempts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('blocked_email_attempts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "blocked_email_attempts" ADD COLUMN IF NOT EXISTS "reputation_score" integer;
  ELSE
    RAISE NOTICE 'Skipped column reputation_score: blocked_email_attempts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reputation_score on blocked_email_attempts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('blocked_email_attempts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "blocked_email_attempts" ADD COLUMN IF NOT EXISTS "ip_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column ip_hash: blocked_email_attempts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ip_hash on blocked_email_attempts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('blocked_email_attempts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "blocked_email_attempts" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: blocked_email_attempts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on blocked_email_attempts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('education_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "education_history" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: education_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on education_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('education_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "education_history" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: education_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on education_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('education_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "education_history" ADD COLUMN IF NOT EXISTS "school" text;
  ELSE
    RAISE NOTICE 'Skipped column school: education_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column school on education_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('education_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "education_history" ADD COLUMN IF NOT EXISTS "degree" text;
  ELSE
    RAISE NOTICE 'Skipped column degree: education_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column degree on education_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('education_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "education_history" ADD COLUMN IF NOT EXISTS "field" text;
  ELSE
    RAISE NOTICE 'Skipped column field: education_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column field on education_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('education_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "education_history" ADD COLUMN IF NOT EXISTS "start_year" integer;
  ELSE
    RAISE NOTICE 'Skipped column start_year: education_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column start_year on education_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('education_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "education_history" ADD COLUMN IF NOT EXISTS "end_year" integer;
  ELSE
    RAISE NOTICE 'Skipped column end_year: education_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column end_year on education_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('education_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "education_history" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: education_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on education_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('education_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "education_history" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: education_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on education_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('email_verification_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "email_verification_tokens" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: email_verification_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on email_verification_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('email_verification_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "email_verification_tokens" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: email_verification_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on email_verification_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('email_verification_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "email_verification_tokens" ADD COLUMN IF NOT EXISTS "token_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column token_hash: email_verification_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column token_hash on email_verification_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('email_verification_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "email_verification_tokens" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column expires_at: email_verification_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column expires_at on email_verification_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('email_verification_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "email_verification_tokens" ADD COLUMN IF NOT EXISTS "used_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column used_at: email_verification_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column used_at on email_verification_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('email_verification_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "email_verification_tokens" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: email_verification_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on email_verification_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('follows') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: follows is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on follows: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('follows') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "follower_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column follower_id: follows is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column follower_id on follows: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('follows') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "following_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column following_id: follows is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column following_id on follows: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('follows') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "follows" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: follows is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on follows: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_events" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: login_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on login_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_events" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: login_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on login_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_events" ADD COLUMN IF NOT EXISTS "ip_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column ip_hash: login_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ip_hash on login_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_events" ADD COLUMN IF NOT EXISTS "user_agent" text;
  ELSE
    RAISE NOTICE 'Skipped column user_agent: login_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_agent on login_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_events" ADD COLUMN IF NOT EXISTS "country" text;
  ELSE
    RAISE NOTICE 'Skipped column country: login_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column country on login_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_events" ADD COLUMN IF NOT EXISTS "timezone" text;
  ELSE
    RAISE NOTICE 'Skipped column timezone: login_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column timezone on login_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_events" ADD COLUMN IF NOT EXISTS "integrity_status" text DEFAULT 'normal' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column integrity_status: login_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column integrity_status on login_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_events" ADD COLUMN IF NOT EXISTS "risk_score" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column risk_score: login_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column risk_score on login_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: login_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on login_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('revoked_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "revoked_tokens" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: revoked_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on revoked_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('revoked_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "revoked_tokens" ADD COLUMN IF NOT EXISTS "token_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column token_hash: revoked_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column token_hash on revoked_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('revoked_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "revoked_tokens" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column expires_at: revoked_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column expires_at on revoked_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('revoked_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "revoked_tokens" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: revoked_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on revoked_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('sessions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: sessions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on sessions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('sessions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: sessions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on sessions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('sessions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "token_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column token_hash: sessions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column token_hash on sessions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('sessions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "user_agent" text;
  ELSE
    RAISE NOTICE 'Skipped column user_agent: sessions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_agent on sessions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('sessions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "ip_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column ip_hash: sessions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ip_hash on sessions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('sessions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column expires_at: sessions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column expires_at on sessions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('sessions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: sessions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on sessions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "public_id" text DEFAULT gen_random_uuid()::text NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column public_id: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column public_id on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;
  ELSE
    RAISE NOTICE 'Skipped column username: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column username on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_username_change_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column last_username_change_at: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column last_username_change_at on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;
  ELSE
    RAISE NOTICE 'Skipped column email: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column email on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column password_hash: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column password_hash on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_version" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column auth_version: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column auth_version on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;
  ELSE
    RAISE NOTICE 'Skipped column display_name: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column display_name on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
  ELSE
    RAISE NOTICE 'Skipped column bio: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column bio on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "headline" text;
  ELSE
    RAISE NOTICE 'Skipped column headline: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column headline on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;
  ELSE
    RAISE NOTICE 'Skipped column avatar_url: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column avatar_url on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cover_url" text;
  ELSE
    RAISE NOTICE 'Skipped column cover_url: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column cover_url on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "website" text;
  ELSE
    RAISE NOTICE 'Skipped column website: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column website on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location" text;
  ELSE
    RAISE NOTICE 'Skipped column location: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column location on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country" text;
  ELSE
    RAISE NOTICE 'Skipped column country: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column country on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "facebook" text;
  ELSE
    RAISE NOTICE 'Skipped column facebook: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column facebook on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "linkedin" text;
  ELSE
    RAISE NOTICE 'Skipped column linkedin: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column linkedin on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twitter" text;
  ELSE
    RAISE NOTICE 'Skipped column twitter: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column twitter on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "instagram" text;
  ELSE
    RAISE NOTICE 'Skipped column instagram: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column instagram on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_visibility" text DEFAULT 'public' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column profile_visibility: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column profile_visibility on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "show_email" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column show_email: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column show_email on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "show_website" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column show_website: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column show_website on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "show_location" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column show_location: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column show_location on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "show_posts_to_everyone" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column show_posts_to_everyone: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column show_posts_to_everyone on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "allow_messages_from_anyone" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column allow_messages_from_anyone: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column allow_messages_from_anyone on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "show_in_search" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column show_in_search: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column show_in_search on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column role: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column role on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lang" text DEFAULT 'en' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column lang: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column lang on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column email_verified: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column email_verified on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_banned" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_banned: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_banned on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banned_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column banned_at: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column banned_at on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_deleted: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_deleted on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column deleted_at: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column deleted_at on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_featured: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_featured on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "featured_until" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column featured_until: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column featured_until on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_complete" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column onboarding_complete: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column onboarding_complete on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_goals" text;
  ELSE
    RAISE NOTICE 'Skipped column onboarding_goals: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column onboarding_goals on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "identity_type" text;
  ELSE
    RAISE NOTICE 'Skipped column identity_type: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column identity_type on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_ip_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column signup_ip_hash: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column signup_ip_hash on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_user_agent" text;
  ELSE
    RAISE NOTICE 'Skipped column signup_user_agent: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column signup_user_agent on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_known_ip_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column last_known_ip_hash: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column last_known_ip_hash on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_known_country" text;
  ELSE
    RAISE NOTICE 'Skipped column last_known_country: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column last_known_country on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_known_timezone" text;
  ELSE
    RAISE NOTICE 'Skipped column last_known_timezone: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column last_known_timezone on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location_integrity_status" text DEFAULT 'unknown' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column location_integrity_status: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column location_integrity_status on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location_risk_score" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column location_risk_score: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column location_risk_score on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_creator_mode" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_creator_mode: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_creator_mode on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "visibility_penalty" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column visibility_penalty: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column visibility_penalty on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reach_multiplier" real DEFAULT 1 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column reach_multiplier: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reach_multiplier on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_premium" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_premium: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_premium on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_official_account" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_official_account: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_official_account on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hire_me_enabled" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column hire_me_enabled: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column hire_me_enabled on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_digest_enabled" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column email_digest_enabled: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column email_digest_enabled on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "topic_notification_enabled" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column topic_notification_enabled: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column topic_notification_enabled on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_prefs" jsonb;
  ELSE
    RAISE NOTICE 'Skipped column notification_prefs: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column notification_prefs on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column two_factor_enabled: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column two_factor_enabled on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret" text;
  ELSE
    RAISE NOTICE 'Skipped column two_factor_secret: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column two_factor_secret on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_token_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column password_reset_token_hash: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column password_reset_token_hash on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_expires" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column password_reset_expires: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column password_reset_expires on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_source" text;
  ELSE
    RAISE NOTICE 'Skipped column referral_source: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column referral_source on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column referred_by: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column referred_by on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('work_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "work_history" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: work_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on work_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('work_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "work_history" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: work_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on work_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('work_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "work_history" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: work_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on work_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('work_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "work_history" ADD COLUMN IF NOT EXISTS "organization" text;
  ELSE
    RAISE NOTICE 'Skipped column organization: work_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column organization on work_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('work_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "work_history" ADD COLUMN IF NOT EXISTS "start_year" integer;
  ELSE
    RAISE NOTICE 'Skipped column start_year: work_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column start_year on work_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('work_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "work_history" ADD COLUMN IF NOT EXISTS "end_year" integer;
  ELSE
    RAISE NOTICE 'Skipped column end_year: work_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column end_year on work_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('work_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "work_history" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: work_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on work_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('work_history') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "work_history" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: work_history is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on work_history: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comment_likes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comment_likes" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: comment_likes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on comment_likes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comment_likes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comment_likes" ADD COLUMN IF NOT EXISTS "comment_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column comment_id: comment_likes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column comment_id on comment_likes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comment_likes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comment_likes" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: comment_likes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on comment_likes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comment_likes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comment_likes" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: comment_likes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on comment_likes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comments') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: comments is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on comments: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comments') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: comments is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on comments: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comments') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "author_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column author_id: comments is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column author_id on comments: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comments') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "content" text;
  ELSE
    RAISE NOTICE 'Skipped column content: comments is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column content on comments: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comments') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "parent_comment_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column parent_comment_id: comments is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column parent_comment_id on comments: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comments') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "depth" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column depth: comments is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column depth on comments: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comments') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "reply_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column reply_count: comments is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reply_count on comments: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comments') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "like_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column like_count: comments is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column like_count on comments: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('comments') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: comments is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on comments: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('likes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "likes" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: likes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on likes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('likes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "likes" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: likes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on likes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('likes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "likes" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: likes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on likes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('likes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "likes" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: likes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on likes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_shares') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_shares" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: post_shares is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on post_shares: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_shares') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_shares" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: post_shares is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on post_shares: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_shares') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_shares" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: post_shares is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on post_shares: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_shares') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_shares" ADD COLUMN IF NOT EXISTS "source" text;
  ELSE
    RAISE NOTICE 'Skipped column source: post_shares is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column source on post_shares: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_shares') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_shares" ADD COLUMN IF NOT EXISTS "click_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column click_count: post_shares is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column click_count on post_shares: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_shares') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_shares" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: post_shares is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on post_shares: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "public_id" text DEFAULT gen_random_uuid()::text NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column public_id: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column public_id on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "author_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column author_id: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column author_id on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "title_a" text;
  ELSE
    RAISE NOTICE 'Skipped column title_a: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title_a on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "title_b" text;
  ELSE
    RAISE NOTICE 'Skipped column title_b: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title_b on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "title_a_clicks" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column title_a_clicks: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title_a_clicks on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "title_b_clicks" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column title_b_clicks: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title_b_clicks on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "ab_selected_title" text;
  ELSE
    RAISE NOTICE 'Skipped column ab_selected_title: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ab_selected_title on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "ab_locked_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column ab_locked_at: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ab_locked_at on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "content" text;
  ELSE
    RAISE NOTICE 'Skipped column content: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column content on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "excerpt" text;
  ELSE
    RAISE NOTICE 'Skipped column excerpt: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column excerpt on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'post' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column type: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column type on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "image_url" text;
  ELSE
    RAISE NOTICE 'Skipped column image_url: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column image_url on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "external_url" text;
  ELSE
    RAISE NOTICE 'Skipped column external_url: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column external_url on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "attachments" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column attachments: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column attachments on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "tags" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column tags: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column tags on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_published: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_published on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'public' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column visibility: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column visibility on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column scheduled_at: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column scheduled_at on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column expires_at: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column expires_at on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "viewed_by" jsonb DEFAULT '[]'::jsonb;
  ELSE
    RAISE NOTICE 'Skipped column viewed_by: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column viewed_by on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "is_highlight" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_highlight: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_highlight on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "content_warning" text;
  ELSE
    RAISE NOTICE 'Skipped column content_warning: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column content_warning on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "content_tags" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column content_tags: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column content_tags on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "ai_text_score" real;
  ELSE
    RAISE NOTICE 'Skipped column ai_text_score: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ai_text_score on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "fingerprint" text;
  ELSE
    RAISE NOTICE 'Skipped column fingerprint: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column fingerprint on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "series_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column series_id: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column series_id on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "series_order" integer;
  ELSE
    RAISE NOTICE 'Skipped column series_order: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column series_order on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "group_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column group_id: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column group_id on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "share_click_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column share_click_count: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column share_click_count on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "edited_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column edited_count: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column edited_count on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "is_sponsored" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_sponsored: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_sponsored on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "sponsor_name" text;
  ELSE
    RAISE NOTICE 'Skipped column sponsor_name: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column sponsor_name on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "sponsor_logo_url" text;
  ELSE
    RAISE NOTICE 'Skipped column sponsor_logo_url: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column sponsor_logo_url on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "sponsor_url" text;
  ELSE
    RAISE NOTICE 'Skipped column sponsor_url: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column sponsor_url on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_deleted: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_deleted on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column deleted_at: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column deleted_at on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "is_official_post" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_official_post: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_official_post on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "post_category" text;
  ELSE
    RAISE NOTICE 'Skipped column post_category: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_category on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "official_post_priority" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column official_post_priority: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column official_post_priority on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "cta_buttons" jsonb;
  ELSE
    RAISE NOTICE 'Skipped column cta_buttons: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column cta_buttons on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "official_target_audience" text;
  ELSE
    RAISE NOTICE 'Skipped column official_target_audience: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column official_target_audience on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "official_language" text;
  ELSE
    RAISE NOTICE 'Skipped column official_language: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column official_language on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "challenge_hashtag" text;
  ELSE
    RAISE NOTICE 'Skipped column challenge_hashtag: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column challenge_hashtag on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "challenge_ends_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column challenge_ends_at: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column challenge_ends_at on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "challenge_reward_text" text;
  ELSE
    RAISE NOTICE 'Skipped column challenge_reward_text: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column challenge_reward_text on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "featured_creator_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column featured_creator_id: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column featured_creator_id on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "quoted_post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column quoted_post_id: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column quoted_post_id on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reposts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reposts" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: reposts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on reposts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reposts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reposts" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: reposts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on reposts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reposts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reposts" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: reposts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on reposts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reposts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reposts" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: reposts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on reposts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('saved_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "saved_posts" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: saved_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on saved_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('saved_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "saved_posts" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: saved_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on saved_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('saved_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "saved_posts" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: saved_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on saved_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('saved_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "saved_posts" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: saved_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on saved_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_participants') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: conversation_participants is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on conversation_participants: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_participants') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "conversation_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column conversation_id: conversation_participants is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column conversation_id on conversation_participants: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_participants') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: conversation_participants is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on conversation_participants: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_participants') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "unread_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column unread_count: conversation_participants is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column unread_count on conversation_participants: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_participants') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "joined_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column joined_at: conversation_participants is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column joined_at on conversation_participants: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversations') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: conversations is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on conversations: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversations') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "is_group" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_group: conversations is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_group on conversations: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversations') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "group_name" text;
  ELSE
    RAISE NOTICE 'Skipped column group_name: conversations is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column group_name on conversations: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversations') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "opportunity_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column opportunity_id: conversations is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column opportunity_id on conversations: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversations') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: conversations is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on conversations: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversations') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: conversations is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on conversations: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "conversation_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column conversation_id: messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column conversation_id on messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sender_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column sender_id: messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column sender_id on messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "content" text;
  ELSE
    RAISE NOTICE 'Skipped column content: messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column content on messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column delivered_at: messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column delivered_at on messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "seen_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column seen_at: messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column seen_at on messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_payment_proposals') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_payment_proposals" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: conversation_payment_proposals is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on conversation_payment_proposals: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_payment_proposals') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_payment_proposals" ADD COLUMN IF NOT EXISTS "conversation_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column conversation_id: conversation_payment_proposals is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column conversation_id on conversation_payment_proposals: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_payment_proposals') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_payment_proposals" ADD COLUMN IF NOT EXISTS "proposer_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column proposer_id: conversation_payment_proposals is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column proposer_id on conversation_payment_proposals: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_payment_proposals') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_payment_proposals" ADD COLUMN IF NOT EXISTS "amount" real;
  ELSE
    RAISE NOTICE 'Skipped column amount: conversation_payment_proposals is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column amount on conversation_payment_proposals: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_payment_proposals') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_payment_proposals" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column currency: conversation_payment_proposals is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column currency on conversation_payment_proposals: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_payment_proposals') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_payment_proposals" ADD COLUMN IF NOT EXISTS "note" text;
  ELSE
    RAISE NOTICE 'Skipped column note: conversation_payment_proposals is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column note on conversation_payment_proposals: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_payment_proposals') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_payment_proposals" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'proposed' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: conversation_payment_proposals is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on conversation_payment_proposals: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('conversation_payment_proposals') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "conversation_payment_proposals" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: conversation_payment_proposals is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on conversation_payment_proposals: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_activity_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_activity_logs" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: group_activity_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on group_activity_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_activity_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_activity_logs" ADD COLUMN IF NOT EXISTS "group_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column group_id: group_activity_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column group_id on group_activity_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_activity_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_activity_logs" ADD COLUMN IF NOT EXISTS "actor_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column actor_id: group_activity_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column actor_id on group_activity_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_activity_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_activity_logs" ADD COLUMN IF NOT EXISTS "action" text;
  ELSE
    RAISE NOTICE 'Skipped column action: group_activity_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column action on group_activity_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_activity_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_activity_logs" ADD COLUMN IF NOT EXISTS "details" jsonb DEFAULT '{}'::jsonb NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column details: group_activity_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column details on group_activity_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_activity_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_activity_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: group_activity_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on group_activity_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_bans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_bans" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: group_bans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on group_bans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_bans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_bans" ADD COLUMN IF NOT EXISTS "group_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column group_id: group_bans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column group_id on group_bans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_bans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_bans" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: group_bans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on group_bans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_bans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_bans" ADD COLUMN IF NOT EXISTS "banned_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column banned_by: group_bans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column banned_by on group_bans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_bans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_bans" ADD COLUMN IF NOT EXISTS "reason" text;
  ELSE
    RAISE NOTICE 'Skipped column reason: group_bans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reason on group_bans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_bans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_bans" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: group_bans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on group_bans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_invites') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_invites" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: group_invites is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on group_invites: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_invites') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_invites" ADD COLUMN IF NOT EXISTS "group_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column group_id: group_invites is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column group_id on group_invites: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_invites') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_invites" ADD COLUMN IF NOT EXISTS "invited_by_user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column invited_by_user_id: group_invites is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column invited_by_user_id on group_invites: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_invites') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_invites" ADD COLUMN IF NOT EXISTS "invite_code" text;
  ELSE
    RAISE NOTICE 'Skipped column invite_code: group_invites is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column invite_code on group_invites: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_invites') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_invites" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: group_invites is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on group_invites: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_invites') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_invites" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: group_invites is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on group_invites: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_invites') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_invites" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column expires_at: group_invites is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column expires_at on group_invites: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_join_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_join_requests" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: group_join_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on group_join_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_join_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_join_requests" ADD COLUMN IF NOT EXISTS "group_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column group_id: group_join_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column group_id on group_join_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_join_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_join_requests" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: group_join_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on group_join_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_join_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_join_requests" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: group_join_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on group_join_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_join_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_join_requests" ADD COLUMN IF NOT EXISTS "reviewed_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column reviewed_by: group_join_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reviewed_by on group_join_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_join_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_join_requests" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column reviewed_at: group_join_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reviewed_at on group_join_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_join_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_join_requests" ADD COLUMN IF NOT EXISTS "screening_answers" jsonb DEFAULT '{}'::jsonb NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column screening_answers: group_join_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column screening_answers on group_join_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_join_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_join_requests" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: group_join_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on group_join_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_members') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: group_members is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on group_members: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_members') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "group_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column group_id: group_members is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column group_id on group_members: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_members') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: group_members is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on group_members: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_members') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'member' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column role: group_members is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column role on group_members: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_members') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: group_members is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on group_members: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_members') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "joined_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column joined_at: group_members is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column joined_at on group_members: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_members') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "muted_until" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column muted_until: group_members is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column muted_until on group_members: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_members') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_members" ADD COLUMN IF NOT EXISTS "trust_score_at_join" integer;
  ELSE
    RAISE NOTICE 'Skipped column trust_score_at_join: group_members is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column trust_score_at_join on group_members: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_pinned_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_pinned_posts" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: group_pinned_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on group_pinned_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_pinned_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_pinned_posts" ADD COLUMN IF NOT EXISTS "group_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column group_id: group_pinned_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column group_id on group_pinned_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_pinned_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_pinned_posts" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: group_pinned_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on group_pinned_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_pinned_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_pinned_posts" ADD COLUMN IF NOT EXISTS "pinned_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column pinned_by: group_pinned_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column pinned_by on group_pinned_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_pinned_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_pinned_posts" ADD COLUMN IF NOT EXISTS "pinned_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column pinned_at: group_pinned_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column pinned_at on group_pinned_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "group_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column group_id: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column group_id on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'discussion' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column type: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column type on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "poll" jsonb;
  ELSE
    RAISE NOTICE 'Skipped column poll: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column poll on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "question" jsonb;
  ELSE
    RAISE NOTICE 'Skipped column question: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column question on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "opportunity_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column opportunity_id: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column opportunity_id on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "opportunity_snapshot" jsonb;
  ELSE
    RAISE NOTICE 'Skipped column opportunity_snapshot: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column opportunity_snapshot on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "is_pinned" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_pinned: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_pinned on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "is_announcement" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_announcement: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_announcement on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "comments_enabled" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column comments_enabled: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column comments_enabled on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "approval_status" text DEFAULT 'approved' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column approval_status: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column approval_status on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('group_post_details') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "group_post_details" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: group_post_details is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on group_post_details: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "public_id" text DEFAULT gen_random_uuid()::text NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column public_id: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column public_id on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "slug" text DEFAULT '' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column slug: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column slug on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "name" text;
  ELSE
    RAISE NOTICE 'Skipped column name: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column name on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "icon_image" text;
  ELSE
    RAISE NOTICE 'Skipped column icon_image: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column icon_image on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "cover_image" text;
  ELSE
    RAISE NOTICE 'Skipped column cover_image: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column cover_image on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "avatar_url" text;
  ELSE
    RAISE NOTICE 'Skipped column avatar_url: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column avatar_url on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "cover_url" text;
  ELSE
    RAISE NOTICE 'Skipped column cover_url: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column cover_url on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'general' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column category: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column category on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column tags: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column tags on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "creator_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column creator_id: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_id on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "privacy" text DEFAULT 'open' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column privacy: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column privacy on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'public' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column type: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column type on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "rules" jsonb DEFAULT '[]'::jsonb NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column rules: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column rules on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "is_announcement_only" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_announcement_only: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_announcement_only on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "require_approval_first_three" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column require_approval_first_three: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column require_approval_first_three on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "require_approval_all" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column require_approval_all: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column require_approval_all on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "announcement_policy" text DEFAULT 'admins' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column announcement_policy: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column announcement_policy on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_archived: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_archived on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_deleted: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_deleted on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "features" jsonb DEFAULT '{"eventsEnabled":false}'::jsonb NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column features: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column features on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "is_verified" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_verified: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_verified on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "is_promoted" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_promoted: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_promoted on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "promoted_until" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column promoted_until: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column promoted_until on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('groups') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: groups is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on groups: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "author_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column author_id: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column author_id on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'job' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column type: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column type on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "skills" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column skills: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column skills on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "compensation" text;
  ELSE
    RAISE NOTICE 'Skipped column compensation: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column compensation on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "remote" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column remote: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column remote on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "location" text;
  ELSE
    RAISE NOTICE 'Skipped column location: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column location on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "is_paid" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_paid: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_paid on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "budget" real;
  ELSE
    RAISE NOTICE 'Skipped column budget: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column budget on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "company_name" text;
  ELSE
    RAISE NOTICE 'Skipped column company_name: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column company_name on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "apply_url" text;
  ELSE
    RAISE NOTICE 'Skipped column apply_url: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column apply_url on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "apply_email" text;
  ELSE
    RAISE NOTICE 'Skipped column apply_email: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column apply_email on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_active: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_active on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "is_approved" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_approved: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_approved on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "moderation_status" text DEFAULT 'published' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column moderation_status: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column moderation_status on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_featured: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_featured on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "featured_until" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column featured_until: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column featured_until on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column view_count: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column view_count on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "click_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column click_count: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column click_count on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column expires_at: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column expires_at on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "category" text;
  ELSE
    RAISE NOTICE 'Skipped column category: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column category on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('jobs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: jobs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on jobs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('opportunity_applications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "opportunity_applications" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: opportunity_applications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on opportunity_applications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('opportunity_applications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "opportunity_applications" ADD COLUMN IF NOT EXISTS "job_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column job_id: opportunity_applications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column job_id on opportunity_applications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('opportunity_applications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "opportunity_applications" ADD COLUMN IF NOT EXISTS "applicant_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column applicant_id: opportunity_applications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column applicant_id on opportunity_applications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('opportunity_applications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "opportunity_applications" ADD COLUMN IF NOT EXISTS "message" text;
  ELSE
    RAISE NOTICE 'Skipped column message: opportunity_applications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column message on opportunity_applications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('opportunity_applications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "opportunity_applications" ADD COLUMN IF NOT EXISTS "proposed_budget" real;
  ELSE
    RAISE NOTICE 'Skipped column proposed_budget: opportunity_applications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column proposed_budget on opportunity_applications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('opportunity_applications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "opportunity_applications" ADD COLUMN IF NOT EXISTS "proposed_currency" text DEFAULT 'USD' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column proposed_currency: opportunity_applications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column proposed_currency on opportunity_applications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('opportunity_applications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "opportunity_applications" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: opportunity_applications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on opportunity_applications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('opportunity_applications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "opportunity_applications" ADD COLUMN IF NOT EXISTS "conversation_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column conversation_id: opportunity_applications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column conversation_id on opportunity_applications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('opportunity_applications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "opportunity_applications" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: opportunity_applications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on opportunity_applications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('opportunity_applications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "opportunity_applications" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: opportunity_applications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on opportunity_applications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "type" text;
  ELSE
    RAISE NOTICE 'Skipped column type: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column type on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "actor_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column actor_id: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column actor_id on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "group_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column group_id: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column group_id on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "message" text;
  ELSE
    RAISE NOTICE 'Skipped column message: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column message on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "group_count" integer DEFAULT 1;
  ELSE
    RAISE NOTICE 'Skipped column group_count: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column group_count on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "is_read" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_read: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_read on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'social' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column category: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column category on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "digest_group" text;
  ELSE
    RAISE NOTICE 'Skipped column digest_group: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column digest_group on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('notifications') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: notifications is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on notifications: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('appreciations') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "appreciations" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: appreciations is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on appreciations: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('appreciations') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "appreciations" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: appreciations is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on appreciations: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('appreciations') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "appreciations" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: appreciations is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on appreciations: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('appreciations') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "appreciations" ADD COLUMN IF NOT EXISTS "type" text;
  ELSE
    RAISE NOTICE 'Skipped column type: appreciations is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column type on appreciations: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('appreciations') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "appreciations" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: appreciations is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on appreciations: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('appreciations') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "appreciations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: appreciations is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on appreciations: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_strikes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_strikes" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: moderation_strikes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on moderation_strikes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_strikes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_strikes" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: moderation_strikes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on moderation_strikes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_strikes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_strikes" ADD COLUMN IF NOT EXISTS "report_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column report_id: moderation_strikes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column report_id on moderation_strikes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_strikes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_strikes" ADD COLUMN IF NOT EXISTS "reason" text;
  ELSE
    RAISE NOTICE 'Skipped column reason: moderation_strikes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reason on moderation_strikes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_strikes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_strikes" ADD COLUMN IF NOT EXISTS "severity" integer DEFAULT 1 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column severity: moderation_strikes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column severity on moderation_strikes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_strikes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_strikes" ADD COLUMN IF NOT EXISTS "issued_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column issued_by: moderation_strikes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column issued_by on moderation_strikes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_strikes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_strikes" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column expires_at: moderation_strikes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column expires_at on moderation_strikes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_strikes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_strikes" ADD COLUMN IF NOT EXISTS "acknowledged_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column acknowledged_at: moderation_strikes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column acknowledged_at on moderation_strikes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_strikes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_strikes" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: moderation_strikes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on moderation_strikes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reports') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: reports is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on reports: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reports') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reporter_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column reporter_id: reports is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reporter_id on reports: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reports') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "target_type" text;
  ELSE
    RAISE NOTICE 'Skipped column target_type: reports is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column target_type on reports: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reports') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "target_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column target_id: reports is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column target_id on reports: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reports') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reason" text;
  ELSE
    RAISE NOTICE 'Skipped column reason: reports is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reason on reports: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reports') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'other' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column category: reports is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column category on reports: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reports') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "priority" text DEFAULT 'normal' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column priority: reports is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column priority on reports: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reports') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: reports is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on reports: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reports') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "resolved_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column resolved_by: reports is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column resolved_by on reports: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reports') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: reports is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on reports: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reports') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column resolved_at: reports is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column resolved_at on reports: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_logs" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: admin_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on admin_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_logs" ADD COLUMN IF NOT EXISTS "admin_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column admin_id: admin_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column admin_id on admin_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_logs" ADD COLUMN IF NOT EXISTS "action" text;
  ELSE
    RAISE NOTICE 'Skipped column action: admin_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column action on admin_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_logs" ADD COLUMN IF NOT EXISTS "target_type" text;
  ELSE
    RAISE NOTICE 'Skipped column target_type: admin_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column target_type on admin_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_logs" ADD COLUMN IF NOT EXISTS "target_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column target_id: admin_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column target_id on admin_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_logs" ADD COLUMN IF NOT EXISTS "details" text;
  ELSE
    RAISE NOTICE 'Skipped column details: admin_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column details on admin_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: admin_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on admin_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('system_settings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: system_settings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on system_settings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('system_settings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "key" text;
  ELSE
    RAISE NOTICE 'Skipped column key: system_settings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column key on system_settings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('system_settings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "value" text;
  ELSE
    RAISE NOTICE 'Skipped column value: system_settings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column value on system_settings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('system_settings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: system_settings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on system_settings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('portfolio_items') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: portfolio_items is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on portfolio_items: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('portfolio_items') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: portfolio_items is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on portfolio_items: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('portfolio_items') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: portfolio_items is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on portfolio_items: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('portfolio_items') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: portfolio_items is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on portfolio_items: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('portfolio_items') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "media_url" text;
  ELSE
    RAISE NOTICE 'Skipped column media_url: portfolio_items is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column media_url on portfolio_items: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('portfolio_items') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'general' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column category: portfolio_items is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column category on portfolio_items: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('portfolio_items') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'public' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column visibility: portfolio_items is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column visibility on portfolio_items: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('portfolio_items') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: portfolio_items is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on portfolio_items: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: creator_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on creator_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: creator_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on creator_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "skills" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column skills: creator_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column skills on creator_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "links" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column links: creator_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column links on creator_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "verified" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column verified: creator_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column verified on creator_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "is_available_for_hire" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_available_for_hire: creator_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_available_for_hire on creator_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "available_for" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column available_for: creator_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column available_for on creator_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: creator_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on creator_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: creator_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on creator_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_requests" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: collaboration_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on collaboration_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_requests" ADD COLUMN IF NOT EXISTS "sender_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column sender_id: collaboration_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column sender_id on collaboration_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_requests" ADD COLUMN IF NOT EXISTS "receiver_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column receiver_id: collaboration_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column receiver_id on collaboration_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_requests" ADD COLUMN IF NOT EXISTS "message" text;
  ELSE
    RAISE NOTICE 'Skipped column message: collaboration_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column message on collaboration_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_requests" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: collaboration_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on collaboration_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_requests" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: collaboration_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on collaboration_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_requests" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: collaboration_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on collaboration_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_rooms') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_rooms" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: collaboration_rooms is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on collaboration_rooms: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_rooms') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_rooms" ADD COLUMN IF NOT EXISTS "public_id" text DEFAULT gen_random_uuid()::text NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column public_id: collaboration_rooms is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column public_id on collaboration_rooms: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_rooms') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_rooms" ADD COLUMN IF NOT EXISTS "request_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column request_id: collaboration_rooms is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column request_id on collaboration_rooms: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_rooms') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_rooms" ADD COLUMN IF NOT EXISTS "created_by_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column created_by_id: collaboration_rooms is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_by_id on collaboration_rooms: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_rooms') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_rooms" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: collaboration_rooms is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on collaboration_rooms: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_rooms') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_rooms" ADD COLUMN IF NOT EXISTS "brief" text DEFAULT '' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column brief: collaboration_rooms is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column brief on collaboration_rooms: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_rooms') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_rooms" ADD COLUMN IF NOT EXISTS "split_suggestion" jsonb DEFAULT '{}'::jsonb NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column split_suggestion: collaboration_rooms is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column split_suggestion on collaboration_rooms: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_rooms') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_rooms" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: collaboration_rooms is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on collaboration_rooms: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_rooms') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_rooms" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: collaboration_rooms is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on collaboration_rooms: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collaboration_rooms') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collaboration_rooms" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: collaboration_rooms is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on collaboration_rooms: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('push_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: push_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on push_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('push_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: push_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on push_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('push_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "endpoint" text;
  ELSE
    RAISE NOTICE 'Skipped column endpoint: push_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column endpoint on push_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('push_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "p256dh" text;
  ELSE
    RAISE NOTICE 'Skipped column p256dh: push_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column p256dh on push_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('push_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "auth" text;
  ELSE
    RAISE NOTICE 'Skipped column auth: push_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column auth on push_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('push_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "user_agent" text;
  ELSE
    RAISE NOTICE 'Skipped column user_agent: push_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_agent on push_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('push_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: push_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on push_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('push_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "last_used_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column last_used_at: push_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column last_used_at on push_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('achievements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "achievements" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: achievements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on achievements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('achievements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "achievements" ADD COLUMN IF NOT EXISTS "key" text;
  ELSE
    RAISE NOTICE 'Skipped column key: achievements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column key on achievements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('achievements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "achievements" ADD COLUMN IF NOT EXISTS "name" text;
  ELSE
    RAISE NOTICE 'Skipped column name: achievements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column name on achievements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('achievements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "achievements" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: achievements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on achievements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('achievements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "achievements" ADD COLUMN IF NOT EXISTS "icon" text DEFAULT 'Award' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column icon: achievements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column icon on achievements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('achievements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "achievements" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'milestone' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column category: achievements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column category on achievements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('achievements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "achievements" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: achievements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on achievements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_achievements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_achievements" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: user_achievements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on user_achievements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_achievements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_achievements" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: user_achievements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on user_achievements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_achievements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_achievements" ADD COLUMN IF NOT EXISTS "achievement_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column achievement_id: user_achievements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column achievement_id on user_achievements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_achievements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_achievements" ADD COLUMN IF NOT EXISTS "unlocked_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column unlocked_at: user_achievements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column unlocked_at on user_achievements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('writing_activity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "writing_activity" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: writing_activity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on writing_activity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('writing_activity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "writing_activity" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: writing_activity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on writing_activity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('writing_activity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "writing_activity" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: writing_activity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on writing_activity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('writing_activity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "writing_activity" ADD COLUMN IF NOT EXISTS "write_date" text;
  ELSE
    RAISE NOTICE 'Skipped column write_date: writing_activity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column write_date on writing_activity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('writing_activity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "writing_activity" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: writing_activity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on writing_activity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('writing_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "writing_streaks" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: writing_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on writing_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('writing_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "writing_streaks" ADD COLUMN IF NOT EXISTS "current_streak" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column current_streak: writing_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column current_streak on writing_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('writing_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "writing_streaks" ADD COLUMN IF NOT EXISTS "longest_streak" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column longest_streak: writing_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column longest_streak on writing_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('writing_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "writing_streaks" ADD COLUMN IF NOT EXISTS "last_write_date" text;
  ELSE
    RAISE NOTICE 'Skipped column last_write_date: writing_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column last_write_date on writing_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('writing_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "writing_streaks" ADD COLUMN IF NOT EXISTS "total_days_written" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column total_days_written: writing_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column total_days_written on writing_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('writing_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "writing_streaks" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: writing_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on writing_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_views') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_views" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: post_views is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on post_views: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_views') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_views" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: post_views is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on post_views: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_views') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_views" ADD COLUMN IF NOT EXISTS "viewer_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column viewer_id: post_views is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column viewer_id on post_views: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_views') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_views" ADD COLUMN IF NOT EXISTS "ip_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column ip_hash: post_views is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ip_hash on post_views: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_views') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_views" ADD COLUMN IF NOT EXISTS "user_agent" text;
  ELSE
    RAISE NOTICE 'Skipped column user_agent: post_views is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_agent on post_views: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_views') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_views" ADD COLUMN IF NOT EXISTS "country" text;
  ELSE
    RAISE NOTICE 'Skipped column country: post_views is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column country on post_views: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_views') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_views" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: post_views is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on post_views: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('uploaded_files') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "uploaded_files" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: uploaded_files is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on uploaded_files: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('uploaded_files') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "uploaded_files" ADD COLUMN IF NOT EXISTS "owner_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column owner_id: uploaded_files is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column owner_id on uploaded_files: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('uploaded_files') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "uploaded_files" ADD COLUMN IF NOT EXISTS "original_name" text;
  ELSE
    RAISE NOTICE 'Skipped column original_name: uploaded_files is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column original_name on uploaded_files: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('uploaded_files') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "uploaded_files" ADD COLUMN IF NOT EXISTS "storage_path" text;
  ELSE
    RAISE NOTICE 'Skipped column storage_path: uploaded_files is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column storage_path on uploaded_files: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('uploaded_files') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "uploaded_files" ADD COLUMN IF NOT EXISTS "mime_type" text;
  ELSE
    RAISE NOTICE 'Skipped column mime_type: uploaded_files is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column mime_type on uploaded_files: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('uploaded_files') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "uploaded_files" ADD COLUMN IF NOT EXISTS "size_bytes" integer;
  ELSE
    RAISE NOTICE 'Skipped column size_bytes: uploaded_files is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column size_bytes on uploaded_files: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('uploaded_files') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "uploaded_files" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'general' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column category: uploaded_files is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column category on uploaded_files: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('uploaded_files') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "uploaded_files" ADD COLUMN IF NOT EXISTS "moderation_status" text DEFAULT 'approved' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column moderation_status: uploaded_files is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column moderation_status on uploaded_files: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('uploaded_files') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "uploaded_files" ADD COLUMN IF NOT EXISTS "thumbnail_path" text;
  ELSE
    RAISE NOTICE 'Skipped column thumbnail_path: uploaded_files is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column thumbnail_path on uploaded_files: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('uploaded_files') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "uploaded_files" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: uploaded_files is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on uploaded_files: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('safety_preferences') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "safety_preferences" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: safety_preferences is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on safety_preferences: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('safety_preferences') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "safety_preferences" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: safety_preferences is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on safety_preferences: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('safety_preferences') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "safety_preferences" ADD COLUMN IF NOT EXISTS "muted_words" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column muted_words: safety_preferences is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column muted_words on safety_preferences: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('safety_preferences') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "safety_preferences" ADD COLUMN IF NOT EXISTS "blocked_user_ids" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column blocked_user_ids: safety_preferences is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column blocked_user_ids on safety_preferences: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('safety_preferences') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "safety_preferences" ADD COLUMN IF NOT EXISTS "content_filter" text DEFAULT 'standard' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column content_filter: safety_preferences is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column content_filter on safety_preferences: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('safety_preferences') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "safety_preferences" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: safety_preferences is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on safety_preferences: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_messages" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: support_messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on support_messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_messages" ADD COLUMN IF NOT EXISTS "ticket_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column ticket_id: support_messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ticket_id on support_messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_messages" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: support_messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on support_messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_messages" ADD COLUMN IF NOT EXISTS "message" text;
  ELSE
    RAISE NOTICE 'Skipped column message: support_messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column message on support_messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_messages" ADD COLUMN IF NOT EXISTS "file_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column file_id: support_messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column file_id on support_messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_messages') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_messages" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: support_messages is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on support_messages: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_tickets') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: support_tickets is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on support_tickets: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_tickets') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: support_tickets is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on support_tickets: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_tickets') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "subject" text;
  ELSE
    RAISE NOTICE 'Skipped column subject: support_tickets is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column subject on support_tickets: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_tickets') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'general' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column category: support_tickets is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column category on support_tickets: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_tickets') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "severity" text DEFAULT 'normal' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column severity: support_tickets is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column severity on support_tickets: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_tickets') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'open' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: support_tickets is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on support_tickets: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_tickets') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: support_tickets is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on support_tickets: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('support_tickets') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: support_tickets is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on support_tickets: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('behavior_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "behavior_events" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: behavior_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on behavior_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('behavior_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "behavior_events" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: behavior_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on behavior_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('behavior_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "behavior_events" ADD COLUMN IF NOT EXISTS "event_type" text;
  ELSE
    RAISE NOTICE 'Skipped column event_type: behavior_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column event_type on behavior_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('behavior_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "behavior_events" ADD COLUMN IF NOT EXISTS "severity" integer DEFAULT 1 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column severity: behavior_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column severity on behavior_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('behavior_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "behavior_events" ADD COLUMN IF NOT EXISTS "details" text;
  ELSE
    RAISE NOTICE 'Skipped column details: behavior_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column details on behavior_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('behavior_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "behavior_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: behavior_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on behavior_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_trust_scores" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: post_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on post_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_trust_scores" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: post_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on post_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_trust_scores" ADD COLUMN IF NOT EXISTS "retention_score" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column retention_score: post_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column retention_score on post_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_trust_scores" ADD COLUMN IF NOT EXISTS "save_rate" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column save_rate: post_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column save_rate on post_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_trust_scores" ADD COLUMN IF NOT EXISTS "deep_engagement_rate" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column deep_engagement_rate: post_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column deep_engagement_rate on post_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_trust_scores" ADD COLUMN IF NOT EXISTS "thought_spread" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column thought_spread: post_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column thought_spread on post_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_trust_scores" ADD COLUMN IF NOT EXISTS "cis_score" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column cis_score: post_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column cis_score on post_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_trust_scores" ADD COLUMN IF NOT EXISTS "longevity_score" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column longevity_score: post_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column longevity_score on post_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_trust_scores" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: post_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on post_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reputation_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reputation_events" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: reputation_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on reputation_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reputation_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reputation_events" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: reputation_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on reputation_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reputation_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reputation_events" ADD COLUMN IF NOT EXISTS "type" text;
  ELSE
    RAISE NOTICE 'Skipped column type: reputation_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column type on reputation_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reputation_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reputation_events" ADD COLUMN IF NOT EXISTS "score_change" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column score_change: reputation_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column score_change on reputation_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reputation_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reputation_events" ADD COLUMN IF NOT EXISTS "reason" text;
  ELSE
    RAISE NOTICE 'Skipped column reason: reputation_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reason on reputation_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reputation_events') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reputation_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: reputation_events is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on reputation_events: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_trust_scores" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: user_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on user_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_trust_scores" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: user_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on user_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_trust_scores" ADD COLUMN IF NOT EXISTS "cvs" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column cvs: user_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column cvs on user_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_trust_scores" ADD COLUMN IF NOT EXISTS "bcs" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column bcs: user_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column bcs on user_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_trust_scores" ADD COLUMN IF NOT EXISTS "cts" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column cts: user_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column cts on user_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_trust_scores" ADD COLUMN IF NOT EXISTS "avg_cis" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column avg_cis: user_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column avg_cis on user_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_trust_scores" ADD COLUMN IF NOT EXISTS "uti" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column uti: user_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column uti on user_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_trust_scores" ADD COLUMN IF NOT EXISTS "visibility_multiplier" real DEFAULT 0.3 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column visibility_multiplier: user_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column visibility_multiplier on user_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_trust_scores" ADD COLUMN IF NOT EXISTS "tier" text DEFAULT 'restricted' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column tier: user_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column tier on user_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_trust_scores" ADD COLUMN IF NOT EXISTS "creator_level" text DEFAULT 'new_voice' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column creator_level: user_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_level on user_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_trust_scores" ADD COLUMN IF NOT EXISTS "level_updated_at" timestamp DEFAULT now();
  ELSE
    RAISE NOTICE 'Skipped column level_updated_at: user_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column level_updated_at on user_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_trust_scores') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_trust_scores" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: user_trust_scores is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on user_trust_scores: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_topics') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_topics" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: post_topics is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on post_topics: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_topics') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_topics" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: post_topics is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on post_topics: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_topics') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_topics" ADD COLUMN IF NOT EXISTS "topic_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column topic_id: post_topics is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column topic_id on post_topics: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_topics') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_topics" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: post_topics is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on post_topics: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('topic_follows') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "topic_follows" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: topic_follows is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on topic_follows: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('topic_follows') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "topic_follows" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: topic_follows is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on topic_follows: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('topic_follows') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "topic_follows" ADD COLUMN IF NOT EXISTS "topic_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column topic_id: topic_follows is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column topic_id on topic_follows: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('topic_follows') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "topic_follows" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: topic_follows is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on topic_follows: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('topics') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: topics is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on topics: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('topics') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "name" text;
  ELSE
    RAISE NOTICE 'Skipped column name: topics is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column name on topics: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('topics') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "slug" text;
  ELSE
    RAISE NOTICE 'Skipped column slug: topics is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column slug on topics: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('topics') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: topics is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on topics: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('topics') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "icon_name" text;
  ELSE
    RAISE NOTICE 'Skipped column icon_name: topics is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column icon_name on topics: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('topics') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "post_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column post_count: topics is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_count on topics: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('topics') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "follower_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column follower_count: topics is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column follower_count on topics: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('topics') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: topics is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on topics: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('mentions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "mentions" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: mentions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on mentions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('mentions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "mentions" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: mentions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on mentions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('mentions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "mentions" ADD COLUMN IF NOT EXISTS "mentioned_user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column mentioned_user_id: mentions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column mentioned_user_id on mentions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('mentions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "mentions" ADD COLUMN IF NOT EXISTS "mentioning_user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column mentioning_user_id: mentions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column mentioning_user_id on mentions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('mentions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "mentions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: mentions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on mentions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('translation_cache') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "translation_cache" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: translation_cache is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on translation_cache: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('translation_cache') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "translation_cache" ADD COLUMN IF NOT EXISTS "original_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column original_hash: translation_cache is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column original_hash on translation_cache: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('translation_cache') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "translation_cache" ADD COLUMN IF NOT EXISTS "source_lang" text DEFAULT 'en' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column source_lang: translation_cache is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column source_lang on translation_cache: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('translation_cache') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "translation_cache" ADD COLUMN IF NOT EXISTS "target_lang" text;
  ELSE
    RAISE NOTICE 'Skipped column target_lang: translation_cache is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column target_lang on translation_cache: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('translation_cache') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "translation_cache" ADD COLUMN IF NOT EXISTS "translated_text" text;
  ELSE
    RAISE NOTICE 'Skipped column translated_text: translation_cache is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column translated_text on translation_cache: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('translation_cache') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "translation_cache" ADD COLUMN IF NOT EXISTS "hit_count" integer DEFAULT 1 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column hit_count: translation_cache is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column hit_count on translation_cache: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('translation_cache') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "translation_cache" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: translation_cache is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on translation_cache: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('translation_cache') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "translation_cache" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: translation_cache is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on translation_cache: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('series') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "series" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: series is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on series: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('series') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "series" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: series is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on series: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('series') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "series" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: series is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on series: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('series') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "series" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: series is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on series: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('series') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "series" ADD COLUMN IF NOT EXISTS "cover_image" text;
  ELSE
    RAISE NOTICE 'Skipped column cover_image: series is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column cover_image on series: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('series') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "series" ADD COLUMN IF NOT EXISTS "slug" text;
  ELSE
    RAISE NOTICE 'Skipped column slug: series is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column slug on series: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('series') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "series" ADD COLUMN IF NOT EXISTS "post_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column post_count: series is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_count on series: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('series') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "series" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: series is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on series: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('series') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "series" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: series is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on series: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collection_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collection_posts" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: collection_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on collection_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collection_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collection_posts" ADD COLUMN IF NOT EXISTS "collection_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column collection_id: collection_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column collection_id on collection_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collection_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collection_posts" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: collection_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on collection_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collection_posts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collection_posts" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: collection_posts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on collection_posts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collections') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: collections is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on collections: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collections') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: collections is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on collections: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collections') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "name" text;
  ELSE
    RAISE NOTICE 'Skipped column name: collections is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column name on collections: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collections') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: collections is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on collections: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collections') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_public: collections is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_public on collections: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collections') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "post_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column post_count: collections is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_count on collections: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collections') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: collections is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on collections: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('collections') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: collections is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on collections: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('income_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "income_logs" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: income_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on income_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('income_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "income_logs" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: income_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on income_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('income_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "income_logs" ADD COLUMN IF NOT EXISTS "amount" real;
  ELSE
    RAISE NOTICE 'Skipped column amount: income_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column amount on income_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('income_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "income_logs" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column currency: income_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column currency on income_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('income_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "income_logs" ADD COLUMN IF NOT EXISTS "source" text;
  ELSE
    RAISE NOTICE 'Skipped column source: income_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column source on income_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('income_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "income_logs" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: income_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on income_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('income_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "income_logs" ADD COLUMN IF NOT EXISTS "date" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column date: income_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column date on income_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('income_logs') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "income_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: income_logs is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on income_logs: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_versions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_versions" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: post_versions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on post_versions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_versions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_versions" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: post_versions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on post_versions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_versions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_versions" ADD COLUMN IF NOT EXISTS "editor_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column editor_id: post_versions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column editor_id on post_versions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_versions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_versions" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: post_versions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on post_versions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_versions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_versions" ADD COLUMN IF NOT EXISTS "content" text;
  ELSE
    RAISE NOTICE 'Skipped column content: post_versions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column content on post_versions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_versions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_versions" ADD COLUMN IF NOT EXISTS "excerpt" text;
  ELSE
    RAISE NOTICE 'Skipped column excerpt: post_versions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column excerpt on post_versions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_versions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_versions" ADD COLUMN IF NOT EXISTS "change_reason" text;
  ELSE
    RAISE NOTICE 'Skipped column change_reason: post_versions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column change_reason on post_versions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_versions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_versions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: post_versions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on post_versions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_progress') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_progress" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: reading_progress is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on reading_progress: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_progress') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_progress" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: reading_progress is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on reading_progress: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_progress') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_progress" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: reading_progress is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on reading_progress: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_progress') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_progress" ADD COLUMN IF NOT EXISTS "percent" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column percent: reading_progress is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column percent on reading_progress: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_progress') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_progress" ADD COLUMN IF NOT EXISTS "read_time_ms" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column read_time_ms: reading_progress is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column read_time_ms on reading_progress: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_progress') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_progress" ADD COLUMN IF NOT EXISTS "last_read_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column last_read_at: reading_progress is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column last_read_at on reading_progress: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_progress') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_progress" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: reading_progress is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on reading_progress: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('poll_options') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "poll_options" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: poll_options is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on poll_options: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('poll_options') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "poll_options" ADD COLUMN IF NOT EXISTS "poll_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column poll_id: poll_options is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column poll_id on poll_options: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('poll_options') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "poll_options" ADD COLUMN IF NOT EXISTS "label" text;
  ELSE
    RAISE NOTICE 'Skipped column label: poll_options is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column label on poll_options: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('poll_options') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "poll_options" ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column position: poll_options is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column position on poll_options: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('poll_options') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "poll_options" ADD COLUMN IF NOT EXISTS "vote_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column vote_count: poll_options is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column vote_count on poll_options: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('poll_votes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: poll_votes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on poll_votes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('poll_votes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "poll_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column poll_id: poll_votes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column poll_id on poll_votes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('poll_votes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "option_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column option_id: poll_votes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column option_id on poll_votes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('poll_votes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: poll_votes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on poll_votes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('poll_votes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: poll_votes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on poll_votes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('polls') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: polls is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on polls: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('polls') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: polls is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on polls: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('polls') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "author_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column author_id: polls is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column author_id on polls: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('polls') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "question" text;
  ELSE
    RAISE NOTICE 'Skipped column question: polls is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column question on polls: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('polls') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "allow_multiple" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column allow_multiple: polls is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column allow_multiple on polls: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('polls') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "closes_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column closes_at: polls is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column closes_at on polls: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('polls') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: polls is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on polls: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_fingerprints') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_fingerprints" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: post_fingerprints is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on post_fingerprints: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_fingerprints') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_fingerprints" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: post_fingerprints is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on post_fingerprints: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_fingerprints') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_fingerprints" ADD COLUMN IF NOT EXISTS "shingle" text;
  ELSE
    RAISE NOTICE 'Skipped column shingle: post_fingerprints is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column shingle on post_fingerprints: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('post_fingerprints') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "post_fingerprints" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: post_fingerprints is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on post_fingerprints: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_activity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_activity" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: reading_activity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on reading_activity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_activity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_activity" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: reading_activity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on reading_activity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_activity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_activity" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: reading_activity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on reading_activity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_activity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_activity" ADD COLUMN IF NOT EXISTS "read_date" date;
  ELSE
    RAISE NOTICE 'Skipped column read_date: reading_activity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column read_date on reading_activity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_activity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_activity" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: reading_activity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on reading_activity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_streaks" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: reading_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on reading_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_streaks" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: reading_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on reading_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_streaks" ADD COLUMN IF NOT EXISTS "current_streak" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column current_streak: reading_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column current_streak on reading_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_streaks" ADD COLUMN IF NOT EXISTS "longest_streak" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column longest_streak: reading_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column longest_streak on reading_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_streaks" ADD COLUMN IF NOT EXISTS "last_read_date" date;
  ELSE
    RAISE NOTICE 'Skipped column last_read_date: reading_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column last_read_date on reading_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_streaks" ADD COLUMN IF NOT EXISTS "total_days_read" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column total_days_read: reading_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column total_days_read on reading_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('reading_streaks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "reading_streaks" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: reading_streaks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on reading_streaks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_rules') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_rules" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: moderation_rules is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on moderation_rules: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_rules') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_rules" ADD COLUMN IF NOT EXISTS "name" text;
  ELSE
    RAISE NOTICE 'Skipped column name: moderation_rules is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column name on moderation_rules: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_rules') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_rules" ADD COLUMN IF NOT EXISTS "trigger_type" text;
  ELSE
    RAISE NOTICE 'Skipped column trigger_type: moderation_rules is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column trigger_type on moderation_rules: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_rules') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_rules" ADD COLUMN IF NOT EXISTS "threshold_value" real;
  ELSE
    RAISE NOTICE 'Skipped column threshold_value: moderation_rules is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column threshold_value on moderation_rules: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_rules') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_rules" ADD COLUMN IF NOT EXISTS "window_minutes" integer DEFAULT 60 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column window_minutes: moderation_rules is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column window_minutes on moderation_rules: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_rules') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_rules" ADD COLUMN IF NOT EXISTS "action" text;
  ELSE
    RAISE NOTICE 'Skipped column action: moderation_rules is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column action on moderation_rules: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_rules') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_rules" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_active: moderation_rules is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_active on moderation_rules: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_rules') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_rules" ADD COLUMN IF NOT EXISTS "created_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column created_by: moderation_rules is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_by on moderation_rules: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('moderation_rules') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "moderation_rules" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: moderation_rules is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on moderation_rules: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_notes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_notes" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: admin_notes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on admin_notes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_notes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_notes" ADD COLUMN IF NOT EXISTS "admin_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column admin_id: admin_notes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column admin_id on admin_notes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_notes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_notes" ADD COLUMN IF NOT EXISTS "target_type" text;
  ELSE
    RAISE NOTICE 'Skipped column target_type: admin_notes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column target_type on admin_notes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_notes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_notes" ADD COLUMN IF NOT EXISTS "target_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column target_id: admin_notes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column target_id on admin_notes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_notes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_notes" ADD COLUMN IF NOT EXISTS "note" text;
  ELSE
    RAISE NOTICE 'Skipped column note: admin_notes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column note on admin_notes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_notes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_notes" ADD COLUMN IF NOT EXISTS "is_internal" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_internal: admin_notes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_internal on admin_notes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_notes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_notes" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: admin_notes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on admin_notes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('admin_notes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "admin_notes" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: admin_notes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on admin_notes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('api_keys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: api_keys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on api_keys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('api_keys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: api_keys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on api_keys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('api_keys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "name" text;
  ELSE
    RAISE NOTICE 'Skipped column name: api_keys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column name on api_keys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('api_keys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "key_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column key_hash: api_keys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column key_hash on api_keys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('api_keys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "key_prefix" text;
  ELSE
    RAISE NOTICE 'Skipped column key_prefix: api_keys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column key_prefix on api_keys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('api_keys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "scopes" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column scopes: api_keys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column scopes on api_keys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('api_keys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "rate_limit_per_minute" integer DEFAULT 60 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column rate_limit_per_minute: api_keys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column rate_limit_per_minute on api_keys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('api_keys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "last_used_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column last_used_at: api_keys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column last_used_at on api_keys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('api_keys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column revoked_at: api_keys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column revoked_at on api_keys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('api_keys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_active: api_keys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_active on api_keys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('api_keys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: api_keys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on api_keys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhook_deliveries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: webhook_deliveries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on webhook_deliveries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhook_deliveries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "webhook_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column webhook_id: webhook_deliveries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column webhook_id on webhook_deliveries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhook_deliveries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "event_type" text;
  ELSE
    RAISE NOTICE 'Skipped column event_type: webhook_deliveries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column event_type on webhook_deliveries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhook_deliveries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "payload" text;
  ELSE
    RAISE NOTICE 'Skipped column payload: webhook_deliveries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column payload on webhook_deliveries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhook_deliveries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "response_status" integer;
  ELSE
    RAISE NOTICE 'Skipped column response_status: webhook_deliveries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column response_status on webhook_deliveries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhook_deliveries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "response_body" text;
  ELSE
    RAISE NOTICE 'Skipped column response_body: webhook_deliveries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column response_body on webhook_deliveries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhook_deliveries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "attempted_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column attempted_at: webhook_deliveries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column attempted_at on webhook_deliveries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhook_deliveries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "succeeded" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column succeeded: webhook_deliveries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column succeeded on webhook_deliveries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhooks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: webhooks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on webhooks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhooks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: webhooks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on webhooks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhooks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "url" text;
  ELSE
    RAISE NOTICE 'Skipped column url: webhooks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column url on webhooks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhooks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "secret" text;
  ELSE
    RAISE NOTICE 'Skipped column secret: webhooks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column secret on webhooks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhooks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "events" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column events: webhooks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column events on webhooks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhooks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_active: webhooks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_active on webhooks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhooks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "failure_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column failure_count: webhooks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column failure_count on webhooks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhooks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "last_delivery_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column last_delivery_at: webhooks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column last_delivery_at on webhooks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhooks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "last_success_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column last_success_at: webhooks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column last_success_at on webhooks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('webhooks') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: webhooks is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on webhooks: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('invite_codes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "invite_codes" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: invite_codes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on invite_codes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('invite_codes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "invite_codes" ADD COLUMN IF NOT EXISTS "code" text;
  ELSE
    RAISE NOTICE 'Skipped column code: invite_codes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column code on invite_codes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('invite_codes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "invite_codes" ADD COLUMN IF NOT EXISTS "created_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column created_by: invite_codes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_by on invite_codes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('invite_codes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "invite_codes" ADD COLUMN IF NOT EXISTS "used_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column used_by: invite_codes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column used_by on invite_codes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('invite_codes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "invite_codes" ADD COLUMN IF NOT EXISTS "used_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column used_at: invite_codes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column used_at on invite_codes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('invite_codes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "invite_codes" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column expires_at: invite_codes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column expires_at on invite_codes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('invite_codes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "invite_codes" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_active: invite_codes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_active on invite_codes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('invite_codes') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "invite_codes" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: invite_codes is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on invite_codes: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "slot_key" text;
  ELSE
    RAISE NOTICE 'Skipped column slot_key: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column slot_key on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "target_type" text;
  ELSE
    RAISE NOTICE 'Skipped column target_type: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column target_type on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "target_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column target_id: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column target_id on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "image_url" text;
  ELSE
    RAISE NOTICE 'Skipped column image_url: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column image_url on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "link_url" text;
  ELSE
    RAISE NOTICE 'Skipped column link_url: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column link_url on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_active: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_active on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "assigned_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column assigned_by: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column assigned_by on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "starts_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column starts_at: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column starts_at on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "ends_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column ends_at: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ends_at on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('featured_slots') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "featured_slots" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: featured_slots is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on featured_slots: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "auth_version" integer;
  ELSE
    RAISE NOTICE 'Skipped column auth_version: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column auth_version on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "code_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column code_hash: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column code_hash on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "nonce" text;
  ELSE
    RAISE NOTICE 'Skipped column nonce: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column nonce on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "ip_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column ip_hash: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ip_hash on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "user_agent" text;
  ELSE
    RAISE NOTICE 'Skipped column user_agent: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_agent on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "country" text;
  ELSE
    RAISE NOTICE 'Skipped column country: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column country on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "timezone" text;
  ELSE
    RAISE NOTICE 'Skipped column timezone: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column timezone on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column attempts: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column attempts on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column expires_at: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column expires_at on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "used_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column used_at: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column used_at on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('login_email_challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "login_email_challenges" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: login_email_challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on login_email_challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('magic_link_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "magic_link_tokens" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: magic_link_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on magic_link_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('magic_link_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "magic_link_tokens" ADD COLUMN IF NOT EXISTS "email" text;
  ELSE
    RAISE NOTICE 'Skipped column email: magic_link_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column email on magic_link_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('magic_link_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "magic_link_tokens" ADD COLUMN IF NOT EXISTS "token_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column token_hash: magic_link_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column token_hash on magic_link_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('magic_link_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "magic_link_tokens" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column expires_at: magic_link_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column expires_at on magic_link_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('magic_link_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "magic_link_tokens" ADD COLUMN IF NOT EXISTS "used_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column used_at: magic_link_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column used_at on magic_link_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('magic_link_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "magic_link_tokens" ADD COLUMN IF NOT EXISTS "ip_hash" text;
  ELSE
    RAISE NOTICE 'Skipped column ip_hash: magic_link_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ip_hash on magic_link_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('magic_link_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "magic_link_tokens" ADD COLUMN IF NOT EXISTS "user_agent" text;
  ELSE
    RAISE NOTICE 'Skipped column user_agent: magic_link_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_agent on magic_link_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('magic_link_tokens') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "magic_link_tokens" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: magic_link_tokens is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on magic_link_tokens: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('oauth_accounts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "oauth_accounts" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: oauth_accounts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on oauth_accounts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('oauth_accounts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "oauth_accounts" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: oauth_accounts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on oauth_accounts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('oauth_accounts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "oauth_accounts" ADD COLUMN IF NOT EXISTS "provider" text;
  ELSE
    RAISE NOTICE 'Skipped column provider: oauth_accounts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column provider on oauth_accounts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('oauth_accounts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "oauth_accounts" ADD COLUMN IF NOT EXISTS "provider_account_id" text;
  ELSE
    RAISE NOTICE 'Skipped column provider_account_id: oauth_accounts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column provider_account_id on oauth_accounts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('oauth_accounts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "oauth_accounts" ADD COLUMN IF NOT EXISTS "email" text;
  ELSE
    RAISE NOTICE 'Skipped column email: oauth_accounts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column email on oauth_accounts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('oauth_accounts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "oauth_accounts" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_primary: oauth_accounts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_primary on oauth_accounts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('oauth_accounts') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "oauth_accounts" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: oauth_accounts is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on oauth_accounts: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('passkeys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "passkeys" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: passkeys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on passkeys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('passkeys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "passkeys" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: passkeys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on passkeys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('passkeys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "passkeys" ADD COLUMN IF NOT EXISTS "credential_id" text;
  ELSE
    RAISE NOTICE 'Skipped column credential_id: passkeys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column credential_id on passkeys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('passkeys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "passkeys" ADD COLUMN IF NOT EXISTS "public_key" text;
  ELSE
    RAISE NOTICE 'Skipped column public_key: passkeys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column public_key on passkeys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('passkeys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "passkeys" ADD COLUMN IF NOT EXISTS "counter" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column counter: passkeys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column counter on passkeys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('passkeys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "passkeys" ADD COLUMN IF NOT EXISTS "transports" text;
  ELSE
    RAISE NOTICE 'Skipped column transports: passkeys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column transports on passkeys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('passkeys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "passkeys" ADD COLUMN IF NOT EXISTS "device_name" text;
  ELSE
    RAISE NOTICE 'Skipped column device_name: passkeys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column device_name on passkeys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('passkeys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "passkeys" ADD COLUMN IF NOT EXISTS "last_used_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column last_used_at: passkeys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column last_used_at on passkeys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('passkeys') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "passkeys" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: passkeys is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on passkeys: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenge_submissions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenge_submissions" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: challenge_submissions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on challenge_submissions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenge_submissions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenge_submissions" ADD COLUMN IF NOT EXISTS "challenge_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column challenge_id: challenge_submissions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column challenge_id on challenge_submissions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenge_submissions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenge_submissions" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: challenge_submissions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on challenge_submissions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenge_submissions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenge_submissions" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: challenge_submissions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on challenge_submissions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenge_submissions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenge_submissions" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column submitted_at: challenge_submissions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column submitted_at on challenge_submissions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "prompt" text;
  ELSE
    RAISE NOTICE 'Skipped column prompt: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column prompt on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'open' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column type: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column type on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "word_limit" integer;
  ELSE
    RAISE NOTICE 'Skipped column word_limit: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column word_limit on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "starts_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column starts_at: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column starts_at on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "ends_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column ends_at: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ends_at on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_active: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_active on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_featured: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_featured on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "created_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column created_by: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_by on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "submission_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column submission_count: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column submission_count on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('challenges') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: challenges is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on challenges: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "plan" text;
  ELSE
    RAISE NOTICE 'Skipped column plan: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column plan on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "duration_hours" integer;
  ELSE
    RAISE NOTICE 'Skipped column duration_hours: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column duration_hours on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "reach_multiplier" real DEFAULT 1 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column reach_multiplier: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reach_multiplier on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "placement_priority" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column placement_priority: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column placement_priority on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "targeting" jsonb;
  ELSE
    RAISE NOTICE 'Skipped column targeting: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column targeting on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "admin_note" text;
  ELSE
    RAISE NOTICE 'Skipped column admin_note: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column admin_note on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "granted_by_admin_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column granted_by_admin_id: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column granted_by_admin_id on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "reviewed_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column reviewed_by: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reviewed_by on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column reviewed_at: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reviewed_at on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "boost_starts_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column boost_starts_at: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column boost_starts_at on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "boost_ends_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column boost_ends_at: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column boost_ends_at on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "stripe_session_id" text;
  ELSE
    RAISE NOTICE 'Skipped column stripe_session_id: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column stripe_session_id on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "flw_tx_ref" text;
  ELSE
    RAISE NOTICE 'Skipped column flw_tx_ref: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column flw_tx_ref on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "flw_transaction_id" text;
  ELSE
    RAISE NOTICE 'Skipped column flw_transaction_id: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column flw_transaction_id on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "paid_amount_cents" integer;
  ELSE
    RAISE NOTICE 'Skipped column paid_amount_cents: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column paid_amount_cents on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('boost_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "boost_requests" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: boost_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on boost_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "from_user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column from_user_id: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column from_user_id on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "to_creator_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column to_creator_id: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column to_creator_id on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "service_listing_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column service_listing_id: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column service_listing_id on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "budget" real;
  ELSE
    RAISE NOTICE 'Skipped column budget: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column budget on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column currency: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column currency on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "deadline" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column deadline: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column deadline on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "creator_response" text;
  ELSE
    RAISE NOTICE 'Skipped column creator_response: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_response on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "responded_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column responded_at: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column responded_at on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('commission_requests') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "commission_requests" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: commission_requests is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on commission_requests: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_availability') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_availability" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: creator_availability is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on creator_availability: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_availability') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_availability" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: creator_availability is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on creator_availability: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_availability') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_availability" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'available' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: creator_availability is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on creator_availability: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_availability') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_availability" ADD COLUMN IF NOT EXISTS "available_for" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column available_for: creator_availability is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column available_for on creator_availability: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_availability') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_availability" ADD COLUMN IF NOT EXISTS "hours_per_week" integer;
  ELSE
    RAISE NOTICE 'Skipped column hours_per_week: creator_availability is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column hours_per_week on creator_availability: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_availability') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_availability" ADD COLUMN IF NOT EXISTS "rate_per_hour" real;
  ELSE
    RAISE NOTICE 'Skipped column rate_per_hour: creator_availability is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column rate_per_hour on creator_availability: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_availability') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_availability" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column currency: creator_availability is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column currency on creator_availability: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_availability') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_availability" ADD COLUMN IF NOT EXISTS "timezone" text;
  ELSE
    RAISE NOTICE 'Skipped column timezone: creator_availability is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column timezone on creator_availability: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_availability') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_availability" ADD COLUMN IF NOT EXISTS "public_note" text;
  ELSE
    RAISE NOTICE 'Skipped column public_note: creator_availability is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column public_note on creator_availability: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_availability') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_availability" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: creator_availability is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on creator_availability: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_earnings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_earnings" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: creator_earnings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on creator_earnings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_earnings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_earnings" ADD COLUMN IF NOT EXISTS "creator_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column creator_id: creator_earnings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_id on creator_earnings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_earnings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_earnings" ADD COLUMN IF NOT EXISTS "source" text;
  ELSE
    RAISE NOTICE 'Skipped column source: creator_earnings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column source on creator_earnings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_earnings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_earnings" ADD COLUMN IF NOT EXISTS "source_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column source_id: creator_earnings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column source_id on creator_earnings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_earnings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_earnings" ADD COLUMN IF NOT EXISTS "gross_amount" real;
  ELSE
    RAISE NOTICE 'Skipped column gross_amount: creator_earnings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column gross_amount on creator_earnings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_earnings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_earnings" ADD COLUMN IF NOT EXISTS "platform_fee" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column platform_fee: creator_earnings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column platform_fee on creator_earnings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_earnings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_earnings" ADD COLUMN IF NOT EXISTS "net_amount" real;
  ELSE
    RAISE NOTICE 'Skipped column net_amount: creator_earnings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column net_amount on creator_earnings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_earnings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_earnings" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column currency: creator_earnings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column currency on creator_earnings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_earnings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_earnings" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: creator_earnings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on creator_earnings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_earnings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_earnings" ADD COLUMN IF NOT EXISTS "settled_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column settled_at: creator_earnings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column settled_at on creator_earnings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_earnings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_earnings" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: creator_earnings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on creator_earnings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_payment_transactions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: creator_payment_transactions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on creator_payment_transactions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_payment_transactions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD COLUMN IF NOT EXISTS "buyer_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column buyer_id: creator_payment_transactions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column buyer_id on creator_payment_transactions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_payment_transactions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD COLUMN IF NOT EXISTS "creator_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column creator_id: creator_payment_transactions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_id on creator_payment_transactions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_payment_transactions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD COLUMN IF NOT EXISTS "service_listing_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column service_listing_id: creator_payment_transactions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column service_listing_id on creator_payment_transactions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_payment_transactions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD COLUMN IF NOT EXISTS "commission_request_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column commission_request_id: creator_payment_transactions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column commission_request_id on creator_payment_transactions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_payment_transactions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD COLUMN IF NOT EXISTS "amount" real;
  ELSE
    RAISE NOTICE 'Skipped column amount: creator_payment_transactions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column amount on creator_payment_transactions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_payment_transactions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column currency: creator_payment_transactions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column currency on creator_payment_transactions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_payment_transactions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD COLUMN IF NOT EXISTS "tx_ref" text;
  ELSE
    RAISE NOTICE 'Skipped column tx_ref: creator_payment_transactions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column tx_ref on creator_payment_transactions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_payment_transactions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD COLUMN IF NOT EXISTS "transaction_id" text;
  ELSE
    RAISE NOTICE 'Skipped column transaction_id: creator_payment_transactions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column transaction_id on creator_payment_transactions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_payment_transactions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: creator_payment_transactions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on creator_payment_transactions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_payment_transactions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: creator_payment_transactions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on creator_payment_transactions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_payment_transactions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column paid_at: creator_payment_transactions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column paid_at on creator_payment_transactions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscription_plans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: creator_subscription_plans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on creator_subscription_plans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscription_plans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD COLUMN IF NOT EXISTS "creator_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column creator_id: creator_subscription_plans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_id on creator_subscription_plans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscription_plans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD COLUMN IF NOT EXISTS "name" text;
  ELSE
    RAISE NOTICE 'Skipped column name: creator_subscription_plans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column name on creator_subscription_plans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscription_plans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: creator_subscription_plans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on creator_subscription_plans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscription_plans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD COLUMN IF NOT EXISTS "price_monthly" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column price_monthly: creator_subscription_plans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column price_monthly on creator_subscription_plans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscription_plans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD COLUMN IF NOT EXISTS "price_yearly" real;
  ELSE
    RAISE NOTICE 'Skipped column price_yearly: creator_subscription_plans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column price_yearly on creator_subscription_plans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscription_plans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column currency: creator_subscription_plans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column currency on creator_subscription_plans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscription_plans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD COLUMN IF NOT EXISTS "perks" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column perks: creator_subscription_plans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column perks on creator_subscription_plans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscription_plans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_active: creator_subscription_plans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_active on creator_subscription_plans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscription_plans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD COLUMN IF NOT EXISTS "subscriber_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column subscriber_count: creator_subscription_plans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column subscriber_count on creator_subscription_plans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscription_plans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: creator_subscription_plans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on creator_subscription_plans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscription_plans') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: creator_subscription_plans is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on creator_subscription_plans: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscriptions" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: creator_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on creator_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscriptions" ADD COLUMN IF NOT EXISTS "subscriber_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column subscriber_id: creator_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column subscriber_id on creator_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscriptions" ADD COLUMN IF NOT EXISTS "creator_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column creator_id: creator_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_id on creator_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscriptions" ADD COLUMN IF NOT EXISTS "plan_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column plan_id: creator_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column plan_id on creator_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscriptions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: creator_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on creator_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscriptions" ADD COLUMN IF NOT EXISTS "started_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column started_at: creator_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column started_at on creator_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscriptions" ADD COLUMN IF NOT EXISTS "renews_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column renews_at: creator_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column renews_at on creator_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscriptions" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column cancelled_at: creator_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column cancelled_at on creator_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_subscriptions') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: creator_subscriptions is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on creator_subscriptions: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_tips') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_tips" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: creator_tips is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on creator_tips: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_tips') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_tips" ADD COLUMN IF NOT EXISTS "from_user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column from_user_id: creator_tips is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column from_user_id on creator_tips: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_tips') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_tips" ADD COLUMN IF NOT EXISTS "to_creator_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column to_creator_id: creator_tips is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column to_creator_id on creator_tips: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_tips') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_tips" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: creator_tips is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on creator_tips: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_tips') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_tips" ADD COLUMN IF NOT EXISTS "amount" real;
  ELSE
    RAISE NOTICE 'Skipped column amount: creator_tips is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column amount on creator_tips: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_tips') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_tips" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column currency: creator_tips is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column currency on creator_tips: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_tips') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_tips" ADD COLUMN IF NOT EXISTS "message" text;
  ELSE
    RAISE NOTICE 'Skipped column message: creator_tips is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column message on creator_tips: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_tips') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_tips" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: creator_tips is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on creator_tips: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_tips') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_tips" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: creator_tips is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on creator_tips: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('paid_post_access') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "paid_post_access" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: paid_post_access is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on paid_post_access: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('paid_post_access') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "paid_post_access" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: paid_post_access is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on paid_post_access: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('paid_post_access') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "paid_post_access" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: paid_post_access is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on paid_post_access: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('paid_post_access') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "paid_post_access" ADD COLUMN IF NOT EXISTS "granted_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column granted_at: paid_post_access is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column granted_at on paid_post_access: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('paid_post_access') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "paid_post_access" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column expires_at: paid_post_access is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column expires_at on paid_post_access: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "creator_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column creator_id: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_id on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "category" text;
  ELSE
    RAISE NOTICE 'Skipped column category: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column category on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "deliverables" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column deliverables: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column deliverables on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "pricing_model" text DEFAULT 'fixed' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column pricing_model: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column pricing_model on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "price_from" real;
  ELSE
    RAISE NOTICE 'Skipped column price_from: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column price_from on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "price_to" real;
  ELSE
    RAISE NOTICE 'Skipped column price_to: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column price_to on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column currency: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column currency on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "delivery_days" integer;
  ELSE
    RAISE NOTICE 'Skipped column delivery_days: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column delivery_days on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "portfolio_urls" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column portfolio_urls: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column portfolio_urls on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "skills" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column skills: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column skills on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_active: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_active on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column view_count: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column view_count on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "inquiry_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column inquiry_count: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column inquiry_count on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('service_listings') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: service_listings is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on service_listings: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('skill_endorsements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "skill_endorsements" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: skill_endorsements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on skill_endorsements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('skill_endorsements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "skill_endorsements" ADD COLUMN IF NOT EXISTS "from_user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column from_user_id: skill_endorsements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column from_user_id on skill_endorsements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('skill_endorsements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "skill_endorsements" ADD COLUMN IF NOT EXISTS "to_user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column to_user_id: skill_endorsements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column to_user_id on skill_endorsements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('skill_endorsements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "skill_endorsements" ADD COLUMN IF NOT EXISTS "skill" text;
  ELSE
    RAISE NOTICE 'Skipped column skill: skill_endorsements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column skill on skill_endorsements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('skill_endorsements') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "skill_endorsements" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: skill_endorsements is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on skill_endorsements: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_similarity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_similarity" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: creator_similarity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on creator_similarity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_similarity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_similarity" ADD COLUMN IF NOT EXISTS "creator_a_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column creator_a_id: creator_similarity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_a_id on creator_similarity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_similarity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_similarity" ADD COLUMN IF NOT EXISTS "creator_b_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column creator_b_id: creator_similarity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_b_id on creator_similarity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_similarity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_similarity" ADD COLUMN IF NOT EXISTS "similarity_score" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column similarity_score: creator_similarity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column similarity_score on creator_similarity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_similarity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_similarity" ADD COLUMN IF NOT EXISTS "shared_topic_ids" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column shared_topic_ids: creator_similarity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column shared_topic_ids on creator_similarity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_similarity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_similarity" ADD COLUMN IF NOT EXISTS "audience_overlap" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column audience_overlap: creator_similarity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column audience_overlap on creator_similarity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_similarity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_similarity" ADD COLUMN IF NOT EXISTS "style_score" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column style_score: creator_similarity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column style_score on creator_similarity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('creator_similarity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "creator_similarity" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: creator_similarity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on creator_similarity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_creator_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_creator_affinity" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: user_creator_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on user_creator_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_creator_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_creator_affinity" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: user_creator_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on user_creator_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_creator_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_creator_affinity" ADD COLUMN IF NOT EXISTS "creator_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column creator_id: user_creator_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_id on user_creator_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_creator_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_creator_affinity" ADD COLUMN IF NOT EXISTS "read_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column read_count: user_creator_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column read_count on user_creator_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_creator_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_creator_affinity" ADD COLUMN IF NOT EXISTS "like_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column like_count: user_creator_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column like_count on user_creator_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_creator_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_creator_affinity" ADD COLUMN IF NOT EXISTS "comment_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column comment_count: user_creator_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column comment_count on user_creator_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_creator_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_creator_affinity" ADD COLUMN IF NOT EXISTS "save_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column save_count: user_creator_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column save_count on user_creator_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_creator_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_creator_affinity" ADD COLUMN IF NOT EXISTS "affinity_score" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column affinity_score: user_creator_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column affinity_score on user_creator_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_creator_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_creator_affinity" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: user_creator_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on user_creator_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_taste_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_taste_profiles" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: user_taste_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on user_taste_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_taste_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_taste_profiles" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: user_taste_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on user_taste_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_taste_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_taste_profiles" ADD COLUMN IF NOT EXISTS "top_topic_ids" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column top_topic_ids: user_taste_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column top_topic_ids on user_taste_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_taste_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_taste_profiles" ADD COLUMN IF NOT EXISTS "preferred_content_types" text DEFAULT '[]' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column preferred_content_types: user_taste_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column preferred_content_types on user_taste_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_taste_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_taste_profiles" ADD COLUMN IF NOT EXISTS "avg_read_depth" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column avg_read_depth: user_taste_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column avg_read_depth on user_taste_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_taste_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_taste_profiles" ADD COLUMN IF NOT EXISTS "avg_session_length" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column avg_session_length: user_taste_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column avg_session_length on user_taste_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_taste_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_taste_profiles" ADD COLUMN IF NOT EXISTS "creator_affinities" text DEFAULT '{}' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column creator_affinities: user_taste_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_affinities on user_taste_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_taste_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_taste_profiles" ADD COLUMN IF NOT EXISTS "diversity_score" real DEFAULT 0.5 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column diversity_score: user_taste_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column diversity_score on user_taste_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_taste_profiles') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_taste_profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: user_taste_profiles is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on user_taste_profiles: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_topic_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_topic_affinity" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: user_topic_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on user_topic_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_topic_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_topic_affinity" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: user_topic_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on user_topic_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_topic_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_topic_affinity" ADD COLUMN IF NOT EXISTS "topic_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column topic_id: user_topic_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column topic_id on user_topic_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_topic_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_topic_affinity" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column view_count: user_topic_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column view_count on user_topic_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_topic_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_topic_affinity" ADD COLUMN IF NOT EXISTS "read_depth_total" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column read_depth_total: user_topic_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column read_depth_total on user_topic_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_topic_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_topic_affinity" ADD COLUMN IF NOT EXISTS "like_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column like_count: user_topic_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column like_count on user_topic_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_topic_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_topic_affinity" ADD COLUMN IF NOT EXISTS "save_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column save_count: user_topic_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column save_count on user_topic_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_topic_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_topic_affinity" ADD COLUMN IF NOT EXISTS "comment_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column comment_count: user_topic_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column comment_count on user_topic_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_topic_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_topic_affinity" ADD COLUMN IF NOT EXISTS "affinity_score" real DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column affinity_score: user_topic_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column affinity_score on user_topic_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('user_topic_affinity') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "user_topic_affinity" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: user_topic_affinity is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on user_topic_affinity: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "slug" text;
  ELSE
    RAISE NOTICE 'Skipped column slug: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column slug on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "author_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column author_id: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column author_id on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "summary" text;
  ELSE
    RAISE NOTICE 'Skipped column summary: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column summary on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "body" text;
  ELSE
    RAISE NOTICE 'Skipped column body: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column body on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'open_reference' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column category: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column category on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column tags: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column tags on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "content_type" text DEFAULT 'article' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column content_type: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column content_type on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "media_url" text;
  ELSE
    RAISE NOTICE 'Skipped column media_url: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column media_url on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;
  ELSE
    RAISE NOTICE 'Skipped column thumbnail_url: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column thumbnail_url on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "external_url" text;
  ELSE
    RAISE NOTICE 'Skipped column external_url: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column external_url on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "license" text DEFAULT 'cc_by' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column license: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column license on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_public: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_public on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "is_approved" boolean DEFAULT true NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_approved: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_approved on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column is_featured: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_featured on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column view_count: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column view_count on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "save_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column save_count: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column save_count on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "download_count" integer DEFAULT 0 NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column download_count: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column download_count on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "schema_type" text DEFAULT 'Article' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column schema_type: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column schema_type on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "published_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column published_at: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column published_at on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_entries" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: library_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on library_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_saves') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_saves" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: library_saves is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on library_saves: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_saves') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_saves" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: library_saves is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on library_saves: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_saves') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_saves" ADD COLUMN IF NOT EXISTS "entry_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column entry_id: library_saves is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column entry_id on library_saves: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('library_saves') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "library_saves" ADD COLUMN IF NOT EXISTS "saved_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column saved_at: library_saves is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column saved_at on library_saves: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chain_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chain_entries" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: chain_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on chain_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chain_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chain_entries" ADD COLUMN IF NOT EXISTS "chain_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column chain_id: chain_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column chain_id on chain_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chain_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chain_entries" ADD COLUMN IF NOT EXISTS "post_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column post_id: chain_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column post_id on chain_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chain_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chain_entries" ADD COLUMN IF NOT EXISTS "author_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column author_id: chain_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column author_id on chain_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chain_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chain_entries" ADD COLUMN IF NOT EXISTS "position" integer;
  ELSE
    RAISE NOTICE 'Skipped column position: chain_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column position on chain_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chain_entries') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chain_entries" ADD COLUMN IF NOT EXISTS "added_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column added_at: chain_entries is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column added_at on chain_entries: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "title" text;
  ELSE
    RAISE NOTICE 'Skipped column title: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column title on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "description" text;
  ELSE
    RAISE NOTICE 'Skipped column description: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column description on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "creator_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column creator_id: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column creator_id on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "prompt" text;
  ELSE
    RAISE NOTICE 'Skipped column prompt: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column prompt on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "max_entries" integer DEFAULT 10;
  ELSE
    RAISE NOTICE 'Skipped column max_entries: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column max_entries on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "is_complete" boolean DEFAULT false;
  ELSE
    RAISE NOTICE 'Skipped column is_complete: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_complete on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT true;
  ELSE
    RAISE NOTICE 'Skipped column is_public: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column is_public on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "cover_image" text;
  ELSE
    RAISE NOTICE 'Skipped column cover_image: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column cover_image on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "category" text;
  ELSE
    RAISE NOTICE 'Skipped column category: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column category on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "total_views" integer DEFAULT 0;
  ELSE
    RAISE NOTICE 'Skipped column total_views: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column total_views on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('chains') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "chains" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column updated_at: chains is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column updated_at on chains: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('profile_views') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "profile_views" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: profile_views is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on profile_views: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('profile_views') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "profile_views" ADD COLUMN IF NOT EXISTS "profile_user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column profile_user_id: profile_views is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column profile_user_id on profile_views: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('profile_views') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "profile_views" ADD COLUMN IF NOT EXISTS "viewer_user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column viewer_user_id: profile_views is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column viewer_user_id on profile_views: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('profile_views') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "profile_views" ADD COLUMN IF NOT EXISTS "viewed_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column viewed_at: profile_views is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column viewed_at on profile_views: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('muted_users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "muted_users" ADD COLUMN IF NOT EXISTS "id" integer GENERATED ALWAYS AS IDENTITY (sequence name "muted_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);
  ELSE
    RAISE NOTICE 'Skipped column id: muted_users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on muted_users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('muted_users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "muted_users" ADD COLUMN IF NOT EXISTS "muter_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column muter_id: muted_users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column muter_id on muted_users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('muted_users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "muted_users" ADD COLUMN IF NOT EXISTS "muted_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column muted_id: muted_users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column muted_id on muted_users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('muted_users') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "muted_users" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: muted_users is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on muted_users: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('spam_review_flags') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "spam_review_flags" ADD COLUMN IF NOT EXISTS "id" serial NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column id: spam_review_flags is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column id on spam_review_flags: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('spam_review_flags') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "spam_review_flags" ADD COLUMN IF NOT EXISTS "user_id" integer;
  ELSE
    RAISE NOTICE 'Skipped column user_id: spam_review_flags is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column user_id on spam_review_flags: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('spam_review_flags') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "spam_review_flags" ADD COLUMN IF NOT EXISTS "rule_key" text;
  ELSE
    RAISE NOTICE 'Skipped column rule_key: spam_review_flags is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column rule_key on spam_review_flags: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('spam_review_flags') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "spam_review_flags" ADD COLUMN IF NOT EXISTS "reason" text;
  ELSE
    RAISE NOTICE 'Skipped column reason: spam_review_flags is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reason on spam_review_flags: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('spam_review_flags') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "spam_review_flags" ADD COLUMN IF NOT EXISTS "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column evidence: spam_review_flags is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column evidence on spam_review_flags: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('spam_review_flags') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "spam_review_flags" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column status: spam_review_flags is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column status on spam_review_flags: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('spam_review_flags') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "spam_review_flags" ADD COLUMN IF NOT EXISTS "decision" text;
  ELSE
    RAISE NOTICE 'Skipped column decision: spam_review_flags is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column decision on spam_review_flags: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('spam_review_flags') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "spam_review_flags" ADD COLUMN IF NOT EXISTS "reviewed_by" integer;
  ELSE
    RAISE NOTICE 'Skipped column reviewed_by: spam_review_flags is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reviewed_by on spam_review_flags: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('spam_review_flags') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "spam_review_flags" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;
  ELSE
    RAISE NOTICE 'Skipped column reviewed_at: spam_review_flags is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column reviewed_at on spam_review_flags: %', SQLERRM;
END
$schema_sync$;
DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass('spam_review_flags') AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE "spam_review_flags" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped column created_at: spam_review_flags is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column created_at on spam_review_flags: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'blocked_email_attempts'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "blocked_email_attempts" ADD CONSTRAINT "blocked_email_attempts_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key blocked_email_attempts_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'education_history'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "education_history" ADD CONSTRAINT "education_history_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key education_history_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'email_verification_tokens'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key email_verification_tokens_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'follows'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "follows" ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key follows_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'login_events'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "login_events" ADD CONSTRAINT "login_events_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key login_events_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'revoked_tokens'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "revoked_tokens" ADD CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key revoked_tokens_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'sessions'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key sessions_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key users_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'work_history'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "work_history" ADD CONSTRAINT "work_history_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key work_history_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'comment_likes'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key comment_likes_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'comments'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "comments" ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key comments_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'likes'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "likes" ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key likes_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_shares'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "post_shares" ADD CONSTRAINT "post_shares_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key post_shares_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'posts'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "posts" ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key posts_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reposts'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "reposts" ADD CONSTRAINT "reposts_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key reposts_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'saved_posts'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key saved_posts_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'conversation_participants'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key conversation_participants_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'conversations'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key conversations_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'messages'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key messages_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'conversation_payment_proposals'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "conversation_payment_proposals" ADD CONSTRAINT "conversation_payment_proposals_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key conversation_payment_proposals_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_activity_logs'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "group_activity_logs" ADD CONSTRAINT "group_activity_logs_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key group_activity_logs_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_bans'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "group_bans" ADD CONSTRAINT "group_bans_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key group_bans_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_invites'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key group_invites_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_join_requests'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key group_join_requests_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_members'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "group_members" ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key group_members_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_pinned_posts'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "group_pinned_posts" ADD CONSTRAINT "group_pinned_posts_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key group_pinned_posts_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_post_details'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "group_post_details" ADD CONSTRAINT "group_post_details_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key group_post_details_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'groups'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "groups" ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key groups_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'jobs'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "jobs" ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key jobs_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'opportunity_applications'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "opportunity_applications" ADD CONSTRAINT "opportunity_applications_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key opportunity_applications_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'notifications'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key notifications_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'appreciations'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "appreciations" ADD CONSTRAINT "appreciations_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key appreciations_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'moderation_strikes'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "moderation_strikes" ADD CONSTRAINT "moderation_strikes_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key moderation_strikes_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reports'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key reports_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'admin_logs'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key admin_logs_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'system_settings'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key system_settings_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'portfolio_items'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key portfolio_items_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_profiles'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key creator_profiles_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'collaboration_requests'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key collaboration_requests_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'collaboration_rooms'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "collaboration_rooms" ADD CONSTRAINT "collaboration_rooms_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key collaboration_rooms_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'push_subscriptions'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key push_subscriptions_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'achievements'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "achievements" ADD CONSTRAINT "achievements_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key achievements_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_achievements'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key user_achievements_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'writing_activity'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "writing_activity" ADD CONSTRAINT "writing_activity_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key writing_activity_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'writing_streaks'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "writing_streaks" ADD CONSTRAINT "writing_streaks_pkey" PRIMARY KEY ("user_id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key writing_streaks_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_views'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "post_views" ADD CONSTRAINT "post_views_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key post_views_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'uploaded_files'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key uploaded_files_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'safety_preferences'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "safety_preferences" ADD CONSTRAINT "safety_preferences_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key safety_preferences_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'support_messages'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key support_messages_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'support_tickets'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key support_tickets_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'behavior_events'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "behavior_events" ADD CONSTRAINT "behavior_events_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key behavior_events_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_trust_scores'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "post_trust_scores" ADD CONSTRAINT "post_trust_scores_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key post_trust_scores_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reputation_events'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key reputation_events_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_trust_scores'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "user_trust_scores" ADD CONSTRAINT "user_trust_scores_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key user_trust_scores_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_topics'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "post_topics" ADD CONSTRAINT "post_topics_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key post_topics_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'topic_follows'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key topic_follows_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'topics'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "topics" ADD CONSTRAINT "topics_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key topics_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'mentions'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "mentions" ADD CONSTRAINT "mentions_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key mentions_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'translation_cache'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "translation_cache" ADD CONSTRAINT "translation_cache_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key translation_cache_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'series'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "series" ADD CONSTRAINT "series_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key series_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'collection_posts'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "collection_posts" ADD CONSTRAINT "collection_posts_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key collection_posts_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'collections'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "collections" ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key collections_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'income_logs'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "income_logs" ADD CONSTRAINT "income_logs_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key income_logs_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_versions'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key post_versions_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reading_progress'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key reading_progress_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'poll_options'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key poll_options_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'poll_votes'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key poll_votes_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'polls'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "polls" ADD CONSTRAINT "polls_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key polls_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_fingerprints'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "post_fingerprints" ADD CONSTRAINT "post_fingerprints_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key post_fingerprints_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reading_activity'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "reading_activity" ADD CONSTRAINT "reading_activity_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key reading_activity_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reading_streaks'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "reading_streaks" ADD CONSTRAINT "reading_streaks_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key reading_streaks_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'moderation_rules'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "moderation_rules" ADD CONSTRAINT "moderation_rules_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key moderation_rules_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'admin_notes'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key admin_notes_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'api_keys'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key api_keys_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'webhook_deliveries'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key webhook_deliveries_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'webhooks'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key webhooks_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'invite_codes'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key invite_codes_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'featured_slots'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "featured_slots" ADD CONSTRAINT "featured_slots_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key featured_slots_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'login_email_challenges'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "login_email_challenges" ADD CONSTRAINT "login_email_challenges_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key login_email_challenges_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'magic_link_tokens'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key magic_link_tokens_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'oauth_accounts'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key oauth_accounts_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'passkeys'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key passkeys_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'challenge_submissions'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key challenge_submissions_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'challenges'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "challenges" ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key challenges_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'boost_requests'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key boost_requests_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'commission_requests'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key commission_requests_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_availability'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "creator_availability" ADD CONSTRAINT "creator_availability_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key creator_availability_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_earnings'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key creator_earnings_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_payment_transactions'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key creator_payment_transactions_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_subscription_plans'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "creator_subscription_plans" ADD CONSTRAINT "creator_subscription_plans_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key creator_subscription_plans_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_subscriptions'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "creator_subscriptions" ADD CONSTRAINT "creator_subscriptions_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key creator_subscriptions_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_tips'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "creator_tips" ADD CONSTRAINT "creator_tips_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key creator_tips_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'paid_post_access'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "paid_post_access" ADD CONSTRAINT "paid_post_access_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key paid_post_access_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'service_listings'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key service_listings_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'skill_endorsements'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key skill_endorsements_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_similarity'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "creator_similarity" ADD CONSTRAINT "creator_similarity_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key creator_similarity_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_creator_affinity'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "user_creator_affinity" ADD CONSTRAINT "user_creator_affinity_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key user_creator_affinity_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_taste_profiles'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "user_taste_profiles" ADD CONSTRAINT "user_taste_profiles_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key user_taste_profiles_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_topic_affinity'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "user_topic_affinity" ADD CONSTRAINT "user_topic_affinity_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key user_topic_affinity_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'library_entries'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key library_entries_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'library_saves'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "library_saves" ADD CONSTRAINT "library_saves_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key library_saves_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'chain_entries'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "chain_entries" ADD CONSTRAINT "chain_entries_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key chain_entries_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'chains'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "chains" ADD CONSTRAINT "chains_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key chains_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'profile_views'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key profile_views_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'muted_users'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "muted_users" ADD CONSTRAINT "muted_users_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key muted_users_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'spam_review_flags'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE "spam_review_flags" ADD CONSTRAINT "spam_review_flags_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key spam_review_flags_pkey: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'education_history'::regclass AND conname = 'education_history_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "education_history" LIMIT 1) THEN
      ALTER TABLE "education_history" ADD CONSTRAINT "education_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "education_history" ADD CONSTRAINT "education_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key education_history_user_id_users_id_fk NOT VALID because education_history contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key education_history_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'email_verification_tokens'::regclass AND conname = 'email_verification_tokens_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "email_verification_tokens" LIMIT 1) THEN
      ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key email_verification_tokens_user_id_users_id_fk NOT VALID because email_verification_tokens contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key email_verification_tokens_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'follows'::regclass AND conname = 'follows_follower_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "follows" LIMIT 1) THEN
      ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key follows_follower_id_users_id_fk NOT VALID because follows contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key follows_follower_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'follows'::regclass AND conname = 'follows_following_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "follows" LIMIT 1) THEN
      ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key follows_following_id_users_id_fk NOT VALID because follows contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key follows_following_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'login_events'::regclass AND conname = 'login_events_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "login_events" LIMIT 1) THEN
      ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key login_events_user_id_users_id_fk NOT VALID because login_events contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key login_events_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'sessions'::regclass AND conname = 'sessions_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "sessions" LIMIT 1) THEN
      ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key sessions_user_id_users_id_fk NOT VALID because sessions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key sessions_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'work_history'::regclass AND conname = 'work_history_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "work_history" LIMIT 1) THEN
      ALTER TABLE "work_history" ADD CONSTRAINT "work_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "work_history" ADD CONSTRAINT "work_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key work_history_user_id_users_id_fk NOT VALID because work_history contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key work_history_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'comment_likes'::regclass AND conname = 'comment_likes_comment_id_comments_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "comment_likes" LIMIT 1) THEN
      ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key comment_likes_comment_id_comments_id_fk NOT VALID because comment_likes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key comment_likes_comment_id_comments_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'comment_likes'::regclass AND conname = 'comment_likes_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "comment_likes" LIMIT 1) THEN
      ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key comment_likes_user_id_users_id_fk NOT VALID because comment_likes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key comment_likes_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'comments'::regclass AND conname = 'comments_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "comments" LIMIT 1) THEN
      ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key comments_post_id_posts_id_fk NOT VALID because comments contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key comments_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'comments'::regclass AND conname = 'comments_author_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "comments" LIMIT 1) THEN
      ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key comments_author_id_users_id_fk NOT VALID because comments contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key comments_author_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'likes'::regclass AND conname = 'likes_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "likes" LIMIT 1) THEN
      ALTER TABLE "likes" ADD CONSTRAINT "likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "likes" ADD CONSTRAINT "likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key likes_post_id_posts_id_fk NOT VALID because likes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key likes_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'likes'::regclass AND conname = 'likes_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "likes" LIMIT 1) THEN
      ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key likes_user_id_users_id_fk NOT VALID because likes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key likes_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_shares'::regclass AND conname = 'post_shares_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "post_shares" LIMIT 1) THEN
      ALTER TABLE "post_shares" ADD CONSTRAINT "post_shares_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "post_shares" ADD CONSTRAINT "post_shares_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key post_shares_post_id_posts_id_fk NOT VALID because post_shares contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key post_shares_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_shares'::regclass AND conname = 'post_shares_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "post_shares" LIMIT 1) THEN
      ALTER TABLE "post_shares" ADD CONSTRAINT "post_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "post_shares" ADD CONSTRAINT "post_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key post_shares_user_id_users_id_fk NOT VALID because post_shares contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key post_shares_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'posts'::regclass AND conname = 'posts_author_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "posts" LIMIT 1) THEN
      ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key posts_author_id_users_id_fk NOT VALID because posts contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key posts_author_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'posts'::regclass AND conname = 'posts_quoted_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "posts" LIMIT 1) THEN
      ALTER TABLE "posts" ADD CONSTRAINT "posts_quoted_post_id_posts_id_fk" FOREIGN KEY ("quoted_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "posts" ADD CONSTRAINT "posts_quoted_post_id_posts_id_fk" FOREIGN KEY ("quoted_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key posts_quoted_post_id_posts_id_fk NOT VALID because posts contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key posts_quoted_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reposts'::regclass AND conname = 'reposts_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "reposts" LIMIT 1) THEN
      ALTER TABLE "reposts" ADD CONSTRAINT "reposts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "reposts" ADD CONSTRAINT "reposts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key reposts_post_id_posts_id_fk NOT VALID because reposts contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key reposts_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reposts'::regclass AND conname = 'reposts_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "reposts" LIMIT 1) THEN
      ALTER TABLE "reposts" ADD CONSTRAINT "reposts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "reposts" ADD CONSTRAINT "reposts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key reposts_user_id_users_id_fk NOT VALID because reposts contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key reposts_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'saved_posts'::regclass AND conname = 'saved_posts_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "saved_posts" LIMIT 1) THEN
      ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key saved_posts_post_id_posts_id_fk NOT VALID because saved_posts contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key saved_posts_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'saved_posts'::regclass AND conname = 'saved_posts_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "saved_posts" LIMIT 1) THEN
      ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key saved_posts_user_id_users_id_fk NOT VALID because saved_posts contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key saved_posts_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'conversation_participants'::regclass AND conname = 'conversation_participants_conversation_id_conversations_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "conversation_participants" LIMIT 1) THEN
      ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key conversation_participants_conversation_id_conversations_id_fk NOT VALID because conversation_participants contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key conversation_participants_conversation_id_conversations_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'conversation_participants'::regclass AND conname = 'conversation_participants_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "conversation_participants" LIMIT 1) THEN
      ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key conversation_participants_user_id_users_id_fk NOT VALID because conversation_participants contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key conversation_participants_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'messages'::regclass AND conname = 'messages_conversation_id_conversations_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "messages" LIMIT 1) THEN
      ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key messages_conversation_id_conversations_id_fk NOT VALID because messages contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key messages_conversation_id_conversations_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'messages'::regclass AND conname = 'messages_sender_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "messages" LIMIT 1) THEN
      ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key messages_sender_id_users_id_fk NOT VALID because messages contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key messages_sender_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'conversation_payment_proposals'::regclass AND conname = 'conversation_payment_proposals_conversation_id_conversations_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "conversation_payment_proposals" LIMIT 1) THEN
      ALTER TABLE "conversation_payment_proposals" ADD CONSTRAINT "conversation_payment_proposals_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "conversation_payment_proposals" ADD CONSTRAINT "conversation_payment_proposals_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key conversation_payment_proposals_conversation_id_conversations_id_fk NOT VALID because conversation_payment_proposals contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key conversation_payment_proposals_conversation_id_conversations_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'conversation_payment_proposals'::regclass AND conname = 'conversation_payment_proposals_proposer_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "conversation_payment_proposals" LIMIT 1) THEN
      ALTER TABLE "conversation_payment_proposals" ADD CONSTRAINT "conversation_payment_proposals_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "conversation_payment_proposals" ADD CONSTRAINT "conversation_payment_proposals_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key conversation_payment_proposals_proposer_id_users_id_fk NOT VALID because conversation_payment_proposals contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key conversation_payment_proposals_proposer_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_activity_logs'::regclass AND conname = 'group_activity_logs_group_id_groups_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_activity_logs" LIMIT 1) THEN
      ALTER TABLE "group_activity_logs" ADD CONSTRAINT "group_activity_logs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "group_activity_logs" ADD CONSTRAINT "group_activity_logs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_activity_logs_group_id_groups_id_fk NOT VALID because group_activity_logs contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_activity_logs_group_id_groups_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_activity_logs'::regclass AND conname = 'group_activity_logs_actor_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_activity_logs" LIMIT 1) THEN
      ALTER TABLE "group_activity_logs" ADD CONSTRAINT "group_activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ELSE
      ALTER TABLE "group_activity_logs" ADD CONSTRAINT "group_activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_activity_logs_actor_id_users_id_fk NOT VALID because group_activity_logs contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_activity_logs_actor_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_bans'::regclass AND conname = 'group_bans_group_id_groups_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_bans" LIMIT 1) THEN
      ALTER TABLE "group_bans" ADD CONSTRAINT "group_bans_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "group_bans" ADD CONSTRAINT "group_bans_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_bans_group_id_groups_id_fk NOT VALID because group_bans contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_bans_group_id_groups_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_bans'::regclass AND conname = 'group_bans_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_bans" LIMIT 1) THEN
      ALTER TABLE "group_bans" ADD CONSTRAINT "group_bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "group_bans" ADD CONSTRAINT "group_bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_bans_user_id_users_id_fk NOT VALID because group_bans contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_bans_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_bans'::regclass AND conname = 'group_bans_banned_by_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_bans" LIMIT 1) THEN
      ALTER TABLE "group_bans" ADD CONSTRAINT "group_bans_banned_by_users_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "group_bans" ADD CONSTRAINT "group_bans_banned_by_users_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_bans_banned_by_users_id_fk NOT VALID because group_bans contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_bans_banned_by_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_invites'::regclass AND conname = 'group_invites_group_id_groups_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_invites" LIMIT 1) THEN
      ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_invites_group_id_groups_id_fk NOT VALID because group_invites contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_invites_group_id_groups_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_invites'::regclass AND conname = 'group_invites_invited_by_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_invites" LIMIT 1) THEN
      ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_invites_invited_by_user_id_users_id_fk NOT VALID because group_invites contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_invites_invited_by_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_join_requests'::regclass AND conname = 'group_join_requests_group_id_groups_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_join_requests" LIMIT 1) THEN
      ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_join_requests_group_id_groups_id_fk NOT VALID because group_join_requests contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_join_requests_group_id_groups_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_join_requests'::regclass AND conname = 'group_join_requests_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_join_requests" LIMIT 1) THEN
      ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_join_requests_user_id_users_id_fk NOT VALID because group_join_requests contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_join_requests_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_join_requests'::regclass AND conname = 'group_join_requests_reviewed_by_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_join_requests" LIMIT 1) THEN
      ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_join_requests_reviewed_by_users_id_fk NOT VALID because group_join_requests contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_join_requests_reviewed_by_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_members'::regclass AND conname = 'group_members_group_id_groups_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_members" LIMIT 1) THEN
      ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_members_group_id_groups_id_fk NOT VALID because group_members contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_members_group_id_groups_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_members'::regclass AND conname = 'group_members_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_members" LIMIT 1) THEN
      ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_members_user_id_users_id_fk NOT VALID because group_members contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_members_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_pinned_posts'::regclass AND conname = 'group_pinned_posts_group_id_groups_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_pinned_posts" LIMIT 1) THEN
      ALTER TABLE "group_pinned_posts" ADD CONSTRAINT "group_pinned_posts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "group_pinned_posts" ADD CONSTRAINT "group_pinned_posts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_pinned_posts_group_id_groups_id_fk NOT VALID because group_pinned_posts contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_pinned_posts_group_id_groups_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_pinned_posts'::regclass AND conname = 'group_pinned_posts_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_pinned_posts" LIMIT 1) THEN
      ALTER TABLE "group_pinned_posts" ADD CONSTRAINT "group_pinned_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "group_pinned_posts" ADD CONSTRAINT "group_pinned_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_pinned_posts_post_id_posts_id_fk NOT VALID because group_pinned_posts contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_pinned_posts_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_pinned_posts'::regclass AND conname = 'group_pinned_posts_pinned_by_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_pinned_posts" LIMIT 1) THEN
      ALTER TABLE "group_pinned_posts" ADD CONSTRAINT "group_pinned_posts_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "group_pinned_posts" ADD CONSTRAINT "group_pinned_posts_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_pinned_posts_pinned_by_users_id_fk NOT VALID because group_pinned_posts contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_pinned_posts_pinned_by_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_post_details'::regclass AND conname = 'group_post_details_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_post_details" LIMIT 1) THEN
      ALTER TABLE "group_post_details" ADD CONSTRAINT "group_post_details_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "group_post_details" ADD CONSTRAINT "group_post_details_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_post_details_post_id_posts_id_fk NOT VALID because group_post_details contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_post_details_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'group_post_details'::regclass AND conname = 'group_post_details_group_id_groups_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "group_post_details" LIMIT 1) THEN
      ALTER TABLE "group_post_details" ADD CONSTRAINT "group_post_details_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "group_post_details" ADD CONSTRAINT "group_post_details_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key group_post_details_group_id_groups_id_fk NOT VALID because group_post_details contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key group_post_details_group_id_groups_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'groups'::regclass AND conname = 'groups_creator_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "groups" LIMIT 1) THEN
      ALTER TABLE "groups" ADD CONSTRAINT "groups_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "groups" ADD CONSTRAINT "groups_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key groups_creator_id_users_id_fk NOT VALID because groups contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key groups_creator_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'jobs'::regclass AND conname = 'jobs_author_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "jobs" LIMIT 1) THEN
      ALTER TABLE "jobs" ADD CONSTRAINT "jobs_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "jobs" ADD CONSTRAINT "jobs_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key jobs_author_id_users_id_fk NOT VALID because jobs contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key jobs_author_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'opportunity_applications'::regclass AND conname = 'opportunity_applications_job_id_jobs_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "opportunity_applications" LIMIT 1) THEN
      ALTER TABLE "opportunity_applications" ADD CONSTRAINT "opportunity_applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "opportunity_applications" ADD CONSTRAINT "opportunity_applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key opportunity_applications_job_id_jobs_id_fk NOT VALID because opportunity_applications contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key opportunity_applications_job_id_jobs_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'opportunity_applications'::regclass AND conname = 'opportunity_applications_applicant_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "opportunity_applications" LIMIT 1) THEN
      ALTER TABLE "opportunity_applications" ADD CONSTRAINT "opportunity_applications_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "opportunity_applications" ADD CONSTRAINT "opportunity_applications_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key opportunity_applications_applicant_id_users_id_fk NOT VALID because opportunity_applications contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key opportunity_applications_applicant_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'notifications'::regclass AND conname = 'notifications_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "notifications" LIMIT 1) THEN
      ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key notifications_user_id_users_id_fk NOT VALID because notifications contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key notifications_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'notifications'::regclass AND conname = 'notifications_actor_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "notifications" LIMIT 1) THEN
      ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key notifications_actor_id_users_id_fk NOT VALID because notifications contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key notifications_actor_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'appreciations'::regclass AND conname = 'appreciations_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "appreciations" LIMIT 1) THEN
      ALTER TABLE "appreciations" ADD CONSTRAINT "appreciations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "appreciations" ADD CONSTRAINT "appreciations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key appreciations_post_id_posts_id_fk NOT VALID because appreciations contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key appreciations_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'appreciations'::regclass AND conname = 'appreciations_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "appreciations" LIMIT 1) THEN
      ALTER TABLE "appreciations" ADD CONSTRAINT "appreciations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "appreciations" ADD CONSTRAINT "appreciations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key appreciations_user_id_users_id_fk NOT VALID because appreciations contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key appreciations_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'moderation_strikes'::regclass AND conname = 'moderation_strikes_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "moderation_strikes" LIMIT 1) THEN
      ALTER TABLE "moderation_strikes" ADD CONSTRAINT "moderation_strikes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "moderation_strikes" ADD CONSTRAINT "moderation_strikes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key moderation_strikes_user_id_users_id_fk NOT VALID because moderation_strikes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key moderation_strikes_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'moderation_strikes'::regclass AND conname = 'moderation_strikes_report_id_reports_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "moderation_strikes" LIMIT 1) THEN
      ALTER TABLE "moderation_strikes" ADD CONSTRAINT "moderation_strikes_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "moderation_strikes" ADD CONSTRAINT "moderation_strikes_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key moderation_strikes_report_id_reports_id_fk NOT VALID because moderation_strikes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key moderation_strikes_report_id_reports_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'moderation_strikes'::regclass AND conname = 'moderation_strikes_issued_by_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "moderation_strikes" LIMIT 1) THEN
      ALTER TABLE "moderation_strikes" ADD CONSTRAINT "moderation_strikes_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "moderation_strikes" ADD CONSTRAINT "moderation_strikes_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key moderation_strikes_issued_by_users_id_fk NOT VALID because moderation_strikes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key moderation_strikes_issued_by_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reports'::regclass AND conname = 'reports_reporter_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "reports" LIMIT 1) THEN
      ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key reports_reporter_id_users_id_fk NOT VALID because reports contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key reports_reporter_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reports'::regclass AND conname = 'reports_resolved_by_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "reports" LIMIT 1) THEN
      ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key reports_resolved_by_users_id_fk NOT VALID because reports contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key reports_resolved_by_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'admin_logs'::regclass AND conname = 'admin_logs_admin_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "admin_logs" LIMIT 1) THEN
      ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key admin_logs_admin_id_users_id_fk NOT VALID because admin_logs contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key admin_logs_admin_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'portfolio_items'::regclass AND conname = 'portfolio_items_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "portfolio_items" LIMIT 1) THEN
      ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key portfolio_items_user_id_users_id_fk NOT VALID because portfolio_items contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key portfolio_items_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_profiles'::regclass AND conname = 'creator_profiles_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_profiles" LIMIT 1) THEN
      ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_profiles_user_id_users_id_fk NOT VALID because creator_profiles contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_profiles_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'collaboration_requests'::regclass AND conname = 'collaboration_requests_sender_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "collaboration_requests" LIMIT 1) THEN
      ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key collaboration_requests_sender_id_users_id_fk NOT VALID because collaboration_requests contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key collaboration_requests_sender_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'collaboration_requests'::regclass AND conname = 'collaboration_requests_receiver_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "collaboration_requests" LIMIT 1) THEN
      ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key collaboration_requests_receiver_id_users_id_fk NOT VALID because collaboration_requests contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key collaboration_requests_receiver_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'collaboration_rooms'::regclass AND conname = 'collaboration_rooms_request_id_collaboration_requests_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "collaboration_rooms" LIMIT 1) THEN
      ALTER TABLE "collaboration_rooms" ADD CONSTRAINT "collaboration_rooms_request_id_collaboration_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."collaboration_requests"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "collaboration_rooms" ADD CONSTRAINT "collaboration_rooms_request_id_collaboration_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."collaboration_requests"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key collaboration_rooms_request_id_collaboration_requests_id_fk NOT VALID because collaboration_rooms contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key collaboration_rooms_request_id_collaboration_requests_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'collaboration_rooms'::regclass AND conname = 'collaboration_rooms_created_by_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "collaboration_rooms" LIMIT 1) THEN
      ALTER TABLE "collaboration_rooms" ADD CONSTRAINT "collaboration_rooms_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "collaboration_rooms" ADD CONSTRAINT "collaboration_rooms_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key collaboration_rooms_created_by_id_users_id_fk NOT VALID because collaboration_rooms contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key collaboration_rooms_created_by_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'push_subscriptions'::regclass AND conname = 'push_subscriptions_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "push_subscriptions" LIMIT 1) THEN
      ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key push_subscriptions_user_id_users_id_fk NOT VALID because push_subscriptions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key push_subscriptions_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_achievements'::regclass AND conname = 'user_achievements_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "user_achievements" LIMIT 1) THEN
      ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key user_achievements_user_id_users_id_fk NOT VALID because user_achievements contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key user_achievements_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_achievements'::regclass AND conname = 'user_achievements_achievement_id_achievements_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "user_achievements" LIMIT 1) THEN
      ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key user_achievements_achievement_id_achievements_id_fk NOT VALID because user_achievements contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key user_achievements_achievement_id_achievements_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'writing_activity'::regclass AND conname = 'writing_activity_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "writing_activity" LIMIT 1) THEN
      ALTER TABLE "writing_activity" ADD CONSTRAINT "writing_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "writing_activity" ADD CONSTRAINT "writing_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key writing_activity_user_id_users_id_fk NOT VALID because writing_activity contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key writing_activity_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'writing_activity'::regclass AND conname = 'writing_activity_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "writing_activity" LIMIT 1) THEN
      ALTER TABLE "writing_activity" ADD CONSTRAINT "writing_activity_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "writing_activity" ADD CONSTRAINT "writing_activity_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key writing_activity_post_id_posts_id_fk NOT VALID because writing_activity contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key writing_activity_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'writing_streaks'::regclass AND conname = 'writing_streaks_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "writing_streaks" LIMIT 1) THEN
      ALTER TABLE "writing_streaks" ADD CONSTRAINT "writing_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "writing_streaks" ADD CONSTRAINT "writing_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key writing_streaks_user_id_users_id_fk NOT VALID because writing_streaks contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key writing_streaks_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_views'::regclass AND conname = 'post_views_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "post_views" LIMIT 1) THEN
      ALTER TABLE "post_views" ADD CONSTRAINT "post_views_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "post_views" ADD CONSTRAINT "post_views_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key post_views_post_id_posts_id_fk NOT VALID because post_views contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key post_views_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_views'::regclass AND conname = 'post_views_viewer_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "post_views" LIMIT 1) THEN
      ALTER TABLE "post_views" ADD CONSTRAINT "post_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "post_views" ADD CONSTRAINT "post_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key post_views_viewer_id_users_id_fk NOT VALID because post_views contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key post_views_viewer_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'uploaded_files'::regclass AND conname = 'uploaded_files_owner_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "uploaded_files" LIMIT 1) THEN
      ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key uploaded_files_owner_id_users_id_fk NOT VALID because uploaded_files contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key uploaded_files_owner_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'safety_preferences'::regclass AND conname = 'safety_preferences_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "safety_preferences" LIMIT 1) THEN
      ALTER TABLE "safety_preferences" ADD CONSTRAINT "safety_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "safety_preferences" ADD CONSTRAINT "safety_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key safety_preferences_user_id_users_id_fk NOT VALID because safety_preferences contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key safety_preferences_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'support_messages'::regclass AND conname = 'support_messages_ticket_id_support_tickets_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "support_messages" LIMIT 1) THEN
      ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key support_messages_ticket_id_support_tickets_id_fk NOT VALID because support_messages contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key support_messages_ticket_id_support_tickets_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'support_messages'::regclass AND conname = 'support_messages_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "support_messages" LIMIT 1) THEN
      ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key support_messages_user_id_users_id_fk NOT VALID because support_messages contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key support_messages_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'support_messages'::regclass AND conname = 'support_messages_file_id_uploaded_files_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "support_messages" LIMIT 1) THEN
      ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key support_messages_file_id_uploaded_files_id_fk NOT VALID because support_messages contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key support_messages_file_id_uploaded_files_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'support_tickets'::regclass AND conname = 'support_tickets_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "support_tickets" LIMIT 1) THEN
      ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key support_tickets_user_id_users_id_fk NOT VALID because support_tickets contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key support_tickets_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'behavior_events'::regclass AND conname = 'behavior_events_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "behavior_events" LIMIT 1) THEN
      ALTER TABLE "behavior_events" ADD CONSTRAINT "behavior_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "behavior_events" ADD CONSTRAINT "behavior_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key behavior_events_user_id_users_id_fk NOT VALID because behavior_events contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key behavior_events_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_trust_scores'::regclass AND conname = 'post_trust_scores_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "post_trust_scores" LIMIT 1) THEN
      ALTER TABLE "post_trust_scores" ADD CONSTRAINT "post_trust_scores_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "post_trust_scores" ADD CONSTRAINT "post_trust_scores_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key post_trust_scores_post_id_posts_id_fk NOT VALID because post_trust_scores contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key post_trust_scores_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reputation_events'::regclass AND conname = 'reputation_events_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "reputation_events" LIMIT 1) THEN
      ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key reputation_events_user_id_users_id_fk NOT VALID because reputation_events contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key reputation_events_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_trust_scores'::regclass AND conname = 'user_trust_scores_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "user_trust_scores" LIMIT 1) THEN
      ALTER TABLE "user_trust_scores" ADD CONSTRAINT "user_trust_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "user_trust_scores" ADD CONSTRAINT "user_trust_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key user_trust_scores_user_id_users_id_fk NOT VALID because user_trust_scores contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key user_trust_scores_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_topics'::regclass AND conname = 'post_topics_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "post_topics" LIMIT 1) THEN
      ALTER TABLE "post_topics" ADD CONSTRAINT "post_topics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "post_topics" ADD CONSTRAINT "post_topics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key post_topics_post_id_posts_id_fk NOT VALID because post_topics contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key post_topics_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_topics'::regclass AND conname = 'post_topics_topic_id_topics_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "post_topics" LIMIT 1) THEN
      ALTER TABLE "post_topics" ADD CONSTRAINT "post_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "post_topics" ADD CONSTRAINT "post_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key post_topics_topic_id_topics_id_fk NOT VALID because post_topics contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key post_topics_topic_id_topics_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'topic_follows'::regclass AND conname = 'topic_follows_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "topic_follows" LIMIT 1) THEN
      ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key topic_follows_user_id_users_id_fk NOT VALID because topic_follows contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key topic_follows_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'topic_follows'::regclass AND conname = 'topic_follows_topic_id_topics_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "topic_follows" LIMIT 1) THEN
      ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key topic_follows_topic_id_topics_id_fk NOT VALID because topic_follows contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key topic_follows_topic_id_topics_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'mentions'::regclass AND conname = 'mentions_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "mentions" LIMIT 1) THEN
      ALTER TABLE "mentions" ADD CONSTRAINT "mentions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "mentions" ADD CONSTRAINT "mentions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key mentions_post_id_posts_id_fk NOT VALID because mentions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key mentions_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'mentions'::regclass AND conname = 'mentions_mentioned_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "mentions" LIMIT 1) THEN
      ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key mentions_mentioned_user_id_users_id_fk NOT VALID because mentions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key mentions_mentioned_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'mentions'::regclass AND conname = 'mentions_mentioning_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "mentions" LIMIT 1) THEN
      ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioning_user_id_users_id_fk" FOREIGN KEY ("mentioning_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioning_user_id_users_id_fk" FOREIGN KEY ("mentioning_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key mentions_mentioning_user_id_users_id_fk NOT VALID because mentions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key mentions_mentioning_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'series'::regclass AND conname = 'series_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "series" LIMIT 1) THEN
      ALTER TABLE "series" ADD CONSTRAINT "series_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "series" ADD CONSTRAINT "series_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key series_user_id_users_id_fk NOT VALID because series contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key series_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'collection_posts'::regclass AND conname = 'collection_posts_collection_id_collections_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "collection_posts" LIMIT 1) THEN
      ALTER TABLE "collection_posts" ADD CONSTRAINT "collection_posts_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "collection_posts" ADD CONSTRAINT "collection_posts_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key collection_posts_collection_id_collections_id_fk NOT VALID because collection_posts contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key collection_posts_collection_id_collections_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'collection_posts'::regclass AND conname = 'collection_posts_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "collection_posts" LIMIT 1) THEN
      ALTER TABLE "collection_posts" ADD CONSTRAINT "collection_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "collection_posts" ADD CONSTRAINT "collection_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key collection_posts_post_id_posts_id_fk NOT VALID because collection_posts contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key collection_posts_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'collections'::regclass AND conname = 'collections_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "collections" LIMIT 1) THEN
      ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key collections_user_id_users_id_fk NOT VALID because collections contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key collections_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'income_logs'::regclass AND conname = 'income_logs_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "income_logs" LIMIT 1) THEN
      ALTER TABLE "income_logs" ADD CONSTRAINT "income_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "income_logs" ADD CONSTRAINT "income_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key income_logs_user_id_users_id_fk NOT VALID because income_logs contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key income_logs_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_versions'::regclass AND conname = 'post_versions_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "post_versions" LIMIT 1) THEN
      ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key post_versions_post_id_posts_id_fk NOT VALID because post_versions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key post_versions_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_versions'::regclass AND conname = 'post_versions_editor_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "post_versions" LIMIT 1) THEN
      ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key post_versions_editor_id_users_id_fk NOT VALID because post_versions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key post_versions_editor_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reading_progress'::regclass AND conname = 'reading_progress_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "reading_progress" LIMIT 1) THEN
      ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key reading_progress_user_id_users_id_fk NOT VALID because reading_progress contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key reading_progress_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reading_progress'::regclass AND conname = 'reading_progress_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "reading_progress" LIMIT 1) THEN
      ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key reading_progress_post_id_posts_id_fk NOT VALID because reading_progress contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key reading_progress_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'poll_options'::regclass AND conname = 'poll_options_poll_id_polls_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "poll_options" LIMIT 1) THEN
      ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key poll_options_poll_id_polls_id_fk NOT VALID because poll_options contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key poll_options_poll_id_polls_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'poll_votes'::regclass AND conname = 'poll_votes_poll_id_polls_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "poll_votes" LIMIT 1) THEN
      ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key poll_votes_poll_id_polls_id_fk NOT VALID because poll_votes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key poll_votes_poll_id_polls_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'poll_votes'::regclass AND conname = 'poll_votes_option_id_poll_options_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "poll_votes" LIMIT 1) THEN
      ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key poll_votes_option_id_poll_options_id_fk NOT VALID because poll_votes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key poll_votes_option_id_poll_options_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'poll_votes'::regclass AND conname = 'poll_votes_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "poll_votes" LIMIT 1) THEN
      ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key poll_votes_user_id_users_id_fk NOT VALID because poll_votes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key poll_votes_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'polls'::regclass AND conname = 'polls_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "polls" LIMIT 1) THEN
      ALTER TABLE "polls" ADD CONSTRAINT "polls_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "polls" ADD CONSTRAINT "polls_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key polls_post_id_posts_id_fk NOT VALID because polls contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key polls_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'polls'::regclass AND conname = 'polls_author_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "polls" LIMIT 1) THEN
      ALTER TABLE "polls" ADD CONSTRAINT "polls_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "polls" ADD CONSTRAINT "polls_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key polls_author_id_users_id_fk NOT VALID because polls contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key polls_author_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_fingerprints'::regclass AND conname = 'post_fingerprints_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "post_fingerprints" LIMIT 1) THEN
      ALTER TABLE "post_fingerprints" ADD CONSTRAINT "post_fingerprints_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "post_fingerprints" ADD CONSTRAINT "post_fingerprints_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key post_fingerprints_post_id_posts_id_fk NOT VALID because post_fingerprints contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key post_fingerprints_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reading_activity'::regclass AND conname = 'reading_activity_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "reading_activity" LIMIT 1) THEN
      ALTER TABLE "reading_activity" ADD CONSTRAINT "reading_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "reading_activity" ADD CONSTRAINT "reading_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key reading_activity_user_id_users_id_fk NOT VALID because reading_activity contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key reading_activity_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reading_streaks'::regclass AND conname = 'reading_streaks_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "reading_streaks" LIMIT 1) THEN
      ALTER TABLE "reading_streaks" ADD CONSTRAINT "reading_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "reading_streaks" ADD CONSTRAINT "reading_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key reading_streaks_user_id_users_id_fk NOT VALID because reading_streaks contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key reading_streaks_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'moderation_rules'::regclass AND conname = 'moderation_rules_created_by_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "moderation_rules" LIMIT 1) THEN
      ALTER TABLE "moderation_rules" ADD CONSTRAINT "moderation_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "moderation_rules" ADD CONSTRAINT "moderation_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key moderation_rules_created_by_users_id_fk NOT VALID because moderation_rules contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key moderation_rules_created_by_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'admin_notes'::regclass AND conname = 'admin_notes_admin_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "admin_notes" LIMIT 1) THEN
      ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key admin_notes_admin_id_users_id_fk NOT VALID because admin_notes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key admin_notes_admin_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'api_keys'::regclass AND conname = 'api_keys_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "api_keys" LIMIT 1) THEN
      ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key api_keys_user_id_users_id_fk NOT VALID because api_keys contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key api_keys_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'webhook_deliveries'::regclass AND conname = 'webhook_deliveries_webhook_id_webhooks_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "webhook_deliveries" LIMIT 1) THEN
      ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key webhook_deliveries_webhook_id_webhooks_id_fk NOT VALID because webhook_deliveries contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key webhook_deliveries_webhook_id_webhooks_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'webhooks'::regclass AND conname = 'webhooks_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "webhooks" LIMIT 1) THEN
      ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key webhooks_user_id_users_id_fk NOT VALID because webhooks contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key webhooks_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'invite_codes'::regclass AND conname = 'invite_codes_created_by_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "invite_codes" LIMIT 1) THEN
      ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key invite_codes_created_by_users_id_fk NOT VALID because invite_codes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key invite_codes_created_by_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'invite_codes'::regclass AND conname = 'invite_codes_used_by_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "invite_codes" LIMIT 1) THEN
      ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key invite_codes_used_by_users_id_fk NOT VALID because invite_codes contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key invite_codes_used_by_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'featured_slots'::regclass AND conname = 'featured_slots_assigned_by_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "featured_slots" LIMIT 1) THEN
      ALTER TABLE "featured_slots" ADD CONSTRAINT "featured_slots_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "featured_slots" ADD CONSTRAINT "featured_slots_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key featured_slots_assigned_by_users_id_fk NOT VALID because featured_slots contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key featured_slots_assigned_by_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'login_email_challenges'::regclass AND conname = 'login_email_challenges_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "login_email_challenges" LIMIT 1) THEN
      ALTER TABLE "login_email_challenges" ADD CONSTRAINT "login_email_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "login_email_challenges" ADD CONSTRAINT "login_email_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key login_email_challenges_user_id_users_id_fk NOT VALID because login_email_challenges contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key login_email_challenges_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'oauth_accounts'::regclass AND conname = 'oauth_accounts_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "oauth_accounts" LIMIT 1) THEN
      ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key oauth_accounts_user_id_users_id_fk NOT VALID because oauth_accounts contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key oauth_accounts_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'passkeys'::regclass AND conname = 'passkeys_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "passkeys" LIMIT 1) THEN
      ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key passkeys_user_id_users_id_fk NOT VALID because passkeys contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key passkeys_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'challenge_submissions'::regclass AND conname = 'challenge_submissions_challenge_id_challenges_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "challenge_submissions" LIMIT 1) THEN
      ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key challenge_submissions_challenge_id_challenges_id_fk NOT VALID because challenge_submissions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key challenge_submissions_challenge_id_challenges_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'challenge_submissions'::regclass AND conname = 'challenge_submissions_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "challenge_submissions" LIMIT 1) THEN
      ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key challenge_submissions_user_id_users_id_fk NOT VALID because challenge_submissions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key challenge_submissions_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'challenge_submissions'::regclass AND conname = 'challenge_submissions_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "challenge_submissions" LIMIT 1) THEN
      ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
    ELSE
      ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key challenge_submissions_post_id_posts_id_fk NOT VALID because challenge_submissions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key challenge_submissions_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'challenges'::regclass AND conname = 'challenges_created_by_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "challenges" LIMIT 1) THEN
      ALTER TABLE "challenges" ADD CONSTRAINT "challenges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "challenges" ADD CONSTRAINT "challenges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key challenges_created_by_users_id_fk NOT VALID because challenges contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key challenges_created_by_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'boost_requests'::regclass AND conname = 'boost_requests_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "boost_requests" LIMIT 1) THEN
      ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key boost_requests_user_id_users_id_fk NOT VALID because boost_requests contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key boost_requests_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'boost_requests'::regclass AND conname = 'boost_requests_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "boost_requests" LIMIT 1) THEN
      ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key boost_requests_post_id_posts_id_fk NOT VALID because boost_requests contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key boost_requests_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'boost_requests'::regclass AND conname = 'boost_requests_granted_by_admin_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "boost_requests" LIMIT 1) THEN
      ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_granted_by_admin_id_users_id_fk" FOREIGN KEY ("granted_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_granted_by_admin_id_users_id_fk" FOREIGN KEY ("granted_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key boost_requests_granted_by_admin_id_users_id_fk NOT VALID because boost_requests contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key boost_requests_granted_by_admin_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'boost_requests'::regclass AND conname = 'boost_requests_reviewed_by_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "boost_requests" LIMIT 1) THEN
      ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key boost_requests_reviewed_by_users_id_fk NOT VALID because boost_requests contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key boost_requests_reviewed_by_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'commission_requests'::regclass AND conname = 'commission_requests_from_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "commission_requests" LIMIT 1) THEN
      ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key commission_requests_from_user_id_users_id_fk NOT VALID because commission_requests contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key commission_requests_from_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'commission_requests'::regclass AND conname = 'commission_requests_to_creator_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "commission_requests" LIMIT 1) THEN
      ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_to_creator_id_users_id_fk" FOREIGN KEY ("to_creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_to_creator_id_users_id_fk" FOREIGN KEY ("to_creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key commission_requests_to_creator_id_users_id_fk NOT VALID because commission_requests contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key commission_requests_to_creator_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'commission_requests'::regclass AND conname = 'commission_requests_service_listing_id_service_listings_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "commission_requests" LIMIT 1) THEN
      ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_service_listing_id_service_listings_id_fk" FOREIGN KEY ("service_listing_id") REFERENCES "public"."service_listings"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_service_listing_id_service_listings_id_fk" FOREIGN KEY ("service_listing_id") REFERENCES "public"."service_listings"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key commission_requests_service_listing_id_service_listings_id_fk NOT VALID because commission_requests contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key commission_requests_service_listing_id_service_listings_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_availability'::regclass AND conname = 'creator_availability_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_availability" LIMIT 1) THEN
      ALTER TABLE "creator_availability" ADD CONSTRAINT "creator_availability_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_availability" ADD CONSTRAINT "creator_availability_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_availability_user_id_users_id_fk NOT VALID because creator_availability contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_availability_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_earnings'::regclass AND conname = 'creator_earnings_creator_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_earnings" LIMIT 1) THEN
      ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_earnings_creator_id_users_id_fk NOT VALID because creator_earnings contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_earnings_creator_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_payment_transactions'::regclass AND conname = 'creator_payment_transactions_buyer_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_payment_transactions" LIMIT 1) THEN
      ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_payment_transactions_buyer_id_users_id_fk NOT VALID because creator_payment_transactions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_payment_transactions_buyer_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_payment_transactions'::regclass AND conname = 'creator_payment_transactions_creator_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_payment_transactions" LIMIT 1) THEN
      ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_payment_transactions_creator_id_users_id_fk NOT VALID because creator_payment_transactions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_payment_transactions_creator_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_payment_transactions'::regclass AND conname = 'creator_payment_transactions_service_listing_id_service_listings_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_payment_transactions" LIMIT 1) THEN
      ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_service_listing_id_service_listings_id_fk" FOREIGN KEY ("service_listing_id") REFERENCES "public"."service_listings"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_service_listing_id_service_listings_id_fk" FOREIGN KEY ("service_listing_id") REFERENCES "public"."service_listings"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_payment_transactions_service_listing_id_service_listings_id_fk NOT VALID because creator_payment_transactions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_payment_transactions_service_listing_id_service_listings_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_payment_transactions'::regclass AND conname = 'creator_payment_transactions_commission_request_id_commission_requests_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_payment_transactions" LIMIT 1) THEN
      ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_commission_request_id_commission_requests_id_fk" FOREIGN KEY ("commission_request_id") REFERENCES "public"."commission_requests"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_commission_request_id_commission_requests_id_fk" FOREIGN KEY ("commission_request_id") REFERENCES "public"."commission_requests"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_payment_transactions_commission_request_id_commission_requests_id_fk NOT VALID because creator_payment_transactions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_payment_transactions_commission_request_id_commission_requests_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_subscription_plans'::regclass AND conname = 'creator_subscription_plans_creator_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_subscription_plans" LIMIT 1) THEN
      ALTER TABLE "creator_subscription_plans" ADD CONSTRAINT "creator_subscription_plans_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_subscription_plans" ADD CONSTRAINT "creator_subscription_plans_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_subscription_plans_creator_id_users_id_fk NOT VALID because creator_subscription_plans contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_subscription_plans_creator_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_subscriptions'::regclass AND conname = 'creator_subscriptions_subscriber_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_subscriptions" LIMIT 1) THEN
      ALTER TABLE "creator_subscriptions" ADD CONSTRAINT "creator_subscriptions_subscriber_id_users_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_subscriptions" ADD CONSTRAINT "creator_subscriptions_subscriber_id_users_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_subscriptions_subscriber_id_users_id_fk NOT VALID because creator_subscriptions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_subscriptions_subscriber_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_subscriptions'::regclass AND conname = 'creator_subscriptions_creator_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_subscriptions" LIMIT 1) THEN
      ALTER TABLE "creator_subscriptions" ADD CONSTRAINT "creator_subscriptions_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_subscriptions" ADD CONSTRAINT "creator_subscriptions_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_subscriptions_creator_id_users_id_fk NOT VALID because creator_subscriptions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_subscriptions_creator_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_subscriptions'::regclass AND conname = 'creator_subscriptions_plan_id_creator_subscription_plans_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_subscriptions" LIMIT 1) THEN
      ALTER TABLE "creator_subscriptions" ADD CONSTRAINT "creator_subscriptions_plan_id_creator_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."creator_subscription_plans"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_subscriptions" ADD CONSTRAINT "creator_subscriptions_plan_id_creator_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."creator_subscription_plans"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_subscriptions_plan_id_creator_subscription_plans_id_fk NOT VALID because creator_subscriptions contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_subscriptions_plan_id_creator_subscription_plans_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_tips'::regclass AND conname = 'creator_tips_from_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_tips" LIMIT 1) THEN
      ALTER TABLE "creator_tips" ADD CONSTRAINT "creator_tips_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_tips" ADD CONSTRAINT "creator_tips_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_tips_from_user_id_users_id_fk NOT VALID because creator_tips contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_tips_from_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_tips'::regclass AND conname = 'creator_tips_to_creator_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_tips" LIMIT 1) THEN
      ALTER TABLE "creator_tips" ADD CONSTRAINT "creator_tips_to_creator_id_users_id_fk" FOREIGN KEY ("to_creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_tips" ADD CONSTRAINT "creator_tips_to_creator_id_users_id_fk" FOREIGN KEY ("to_creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_tips_to_creator_id_users_id_fk NOT VALID because creator_tips contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_tips_to_creator_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_tips'::regclass AND conname = 'creator_tips_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_tips" LIMIT 1) THEN
      ALTER TABLE "creator_tips" ADD CONSTRAINT "creator_tips_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_tips" ADD CONSTRAINT "creator_tips_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_tips_post_id_posts_id_fk NOT VALID because creator_tips contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_tips_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'paid_post_access'::regclass AND conname = 'paid_post_access_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "paid_post_access" LIMIT 1) THEN
      ALTER TABLE "paid_post_access" ADD CONSTRAINT "paid_post_access_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "paid_post_access" ADD CONSTRAINT "paid_post_access_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key paid_post_access_post_id_posts_id_fk NOT VALID because paid_post_access contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key paid_post_access_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'paid_post_access'::regclass AND conname = 'paid_post_access_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "paid_post_access" LIMIT 1) THEN
      ALTER TABLE "paid_post_access" ADD CONSTRAINT "paid_post_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "paid_post_access" ADD CONSTRAINT "paid_post_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key paid_post_access_user_id_users_id_fk NOT VALID because paid_post_access contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key paid_post_access_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'service_listings'::regclass AND conname = 'service_listings_creator_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "service_listings" LIMIT 1) THEN
      ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key service_listings_creator_id_users_id_fk NOT VALID because service_listings contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key service_listings_creator_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'skill_endorsements'::regclass AND conname = 'skill_endorsements_from_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "skill_endorsements" LIMIT 1) THEN
      ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key skill_endorsements_from_user_id_users_id_fk NOT VALID because skill_endorsements contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key skill_endorsements_from_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'skill_endorsements'::regclass AND conname = 'skill_endorsements_to_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "skill_endorsements" LIMIT 1) THEN
      ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key skill_endorsements_to_user_id_users_id_fk NOT VALID because skill_endorsements contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key skill_endorsements_to_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_similarity'::regclass AND conname = 'creator_similarity_creator_a_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_similarity" LIMIT 1) THEN
      ALTER TABLE "creator_similarity" ADD CONSTRAINT "creator_similarity_creator_a_id_users_id_fk" FOREIGN KEY ("creator_a_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_similarity" ADD CONSTRAINT "creator_similarity_creator_a_id_users_id_fk" FOREIGN KEY ("creator_a_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_similarity_creator_a_id_users_id_fk NOT VALID because creator_similarity contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_similarity_creator_a_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'creator_similarity'::regclass AND conname = 'creator_similarity_creator_b_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "creator_similarity" LIMIT 1) THEN
      ALTER TABLE "creator_similarity" ADD CONSTRAINT "creator_similarity_creator_b_id_users_id_fk" FOREIGN KEY ("creator_b_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "creator_similarity" ADD CONSTRAINT "creator_similarity_creator_b_id_users_id_fk" FOREIGN KEY ("creator_b_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key creator_similarity_creator_b_id_users_id_fk NOT VALID because creator_similarity contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key creator_similarity_creator_b_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_creator_affinity'::regclass AND conname = 'user_creator_affinity_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "user_creator_affinity" LIMIT 1) THEN
      ALTER TABLE "user_creator_affinity" ADD CONSTRAINT "user_creator_affinity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "user_creator_affinity" ADD CONSTRAINT "user_creator_affinity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key user_creator_affinity_user_id_users_id_fk NOT VALID because user_creator_affinity contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key user_creator_affinity_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_creator_affinity'::regclass AND conname = 'user_creator_affinity_creator_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "user_creator_affinity" LIMIT 1) THEN
      ALTER TABLE "user_creator_affinity" ADD CONSTRAINT "user_creator_affinity_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "user_creator_affinity" ADD CONSTRAINT "user_creator_affinity_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key user_creator_affinity_creator_id_users_id_fk NOT VALID because user_creator_affinity contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key user_creator_affinity_creator_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_taste_profiles'::regclass AND conname = 'user_taste_profiles_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "user_taste_profiles" LIMIT 1) THEN
      ALTER TABLE "user_taste_profiles" ADD CONSTRAINT "user_taste_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "user_taste_profiles" ADD CONSTRAINT "user_taste_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key user_taste_profiles_user_id_users_id_fk NOT VALID because user_taste_profiles contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key user_taste_profiles_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_topic_affinity'::regclass AND conname = 'user_topic_affinity_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "user_topic_affinity" LIMIT 1) THEN
      ALTER TABLE "user_topic_affinity" ADD CONSTRAINT "user_topic_affinity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "user_topic_affinity" ADD CONSTRAINT "user_topic_affinity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key user_topic_affinity_user_id_users_id_fk NOT VALID because user_topic_affinity contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key user_topic_affinity_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'user_topic_affinity'::regclass AND conname = 'user_topic_affinity_topic_id_topics_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "user_topic_affinity" LIMIT 1) THEN
      ALTER TABLE "user_topic_affinity" ADD CONSTRAINT "user_topic_affinity_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "user_topic_affinity" ADD CONSTRAINT "user_topic_affinity_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key user_topic_affinity_topic_id_topics_id_fk NOT VALID because user_topic_affinity contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key user_topic_affinity_topic_id_topics_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'library_entries'::regclass AND conname = 'library_entries_author_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "library_entries" LIMIT 1) THEN
      ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key library_entries_author_id_users_id_fk NOT VALID because library_entries contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key library_entries_author_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'library_saves'::regclass AND conname = 'library_saves_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "library_saves" LIMIT 1) THEN
      ALTER TABLE "library_saves" ADD CONSTRAINT "library_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "library_saves" ADD CONSTRAINT "library_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key library_saves_user_id_users_id_fk NOT VALID because library_saves contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key library_saves_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'library_saves'::regclass AND conname = 'library_saves_entry_id_library_entries_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "library_saves" LIMIT 1) THEN
      ALTER TABLE "library_saves" ADD CONSTRAINT "library_saves_entry_id_library_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."library_entries"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "library_saves" ADD CONSTRAINT "library_saves_entry_id_library_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."library_entries"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key library_saves_entry_id_library_entries_id_fk NOT VALID because library_saves contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key library_saves_entry_id_library_entries_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'chain_entries'::regclass AND conname = 'chain_entries_chain_id_chains_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "chain_entries" LIMIT 1) THEN
      ALTER TABLE "chain_entries" ADD CONSTRAINT "chain_entries_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "chain_entries" ADD CONSTRAINT "chain_entries_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key chain_entries_chain_id_chains_id_fk NOT VALID because chain_entries contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key chain_entries_chain_id_chains_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'chain_entries'::regclass AND conname = 'chain_entries_post_id_posts_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "chain_entries" LIMIT 1) THEN
      ALTER TABLE "chain_entries" ADD CONSTRAINT "chain_entries_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "chain_entries" ADD CONSTRAINT "chain_entries_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key chain_entries_post_id_posts_id_fk NOT VALID because chain_entries contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key chain_entries_post_id_posts_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'chain_entries'::regclass AND conname = 'chain_entries_author_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "chain_entries" LIMIT 1) THEN
      ALTER TABLE "chain_entries" ADD CONSTRAINT "chain_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "chain_entries" ADD CONSTRAINT "chain_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key chain_entries_author_id_users_id_fk NOT VALID because chain_entries contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key chain_entries_author_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'chains'::regclass AND conname = 'chains_creator_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "chains" LIMIT 1) THEN
      ALTER TABLE "chains" ADD CONSTRAINT "chains_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "chains" ADD CONSTRAINT "chains_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key chains_creator_id_users_id_fk NOT VALID because chains contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key chains_creator_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'profile_views'::regclass AND conname = 'profile_views_profile_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "profile_views" LIMIT 1) THEN
      ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_profile_user_id_users_id_fk" FOREIGN KEY ("profile_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_profile_user_id_users_id_fk" FOREIGN KEY ("profile_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key profile_views_profile_user_id_users_id_fk NOT VALID because profile_views contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key profile_views_profile_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'profile_views'::regclass AND conname = 'profile_views_viewer_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "profile_views" LIMIT 1) THEN
      ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ELSE
      ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key profile_views_viewer_user_id_users_id_fk NOT VALID because profile_views contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key profile_views_viewer_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'muted_users'::regclass AND conname = 'muted_users_muter_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "muted_users" LIMIT 1) THEN
      ALTER TABLE "muted_users" ADD CONSTRAINT "muted_users_muter_id_users_id_fk" FOREIGN KEY ("muter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "muted_users" ADD CONSTRAINT "muted_users_muter_id_users_id_fk" FOREIGN KEY ("muter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key muted_users_muter_id_users_id_fk NOT VALID because muted_users contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key muted_users_muter_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'muted_users'::regclass AND conname = 'muted_users_muted_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "muted_users" LIMIT 1) THEN
      ALTER TABLE "muted_users" ADD CONSTRAINT "muted_users_muted_id_users_id_fk" FOREIGN KEY ("muted_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "muted_users" ADD CONSTRAINT "muted_users_muted_id_users_id_fk" FOREIGN KEY ("muted_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key muted_users_muted_id_users_id_fk NOT VALID because muted_users contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key muted_users_muted_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'spam_review_flags'::regclass AND conname = 'spam_review_flags_user_id_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "spam_review_flags" LIMIT 1) THEN
      ALTER TABLE "spam_review_flags" ADD CONSTRAINT "spam_review_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ELSE
      ALTER TABLE "spam_review_flags" ADD CONSTRAINT "spam_review_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key spam_review_flags_user_id_users_id_fk NOT VALID because spam_review_flags contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key spam_review_flags_user_id_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'spam_review_flags'::regclass AND conname = 'spam_review_flags_reviewed_by_users_id_fk'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM "spam_review_flags" LIMIT 1) THEN
      ALTER TABLE "spam_review_flags" ADD CONSTRAINT "spam_review_flags_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ELSE
      ALTER TABLE "spam_review_flags" ADD CONSTRAINT "spam_review_flags_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;
      RAISE NOTICE 'Added foreign key spam_review_flags_reviewed_by_users_id_fk NOT VALID because spam_review_flags contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key spam_review_flags_reviewed_by_users_id_fk: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "revoked_tokens_token_hash_unique" ON "revoked_tokens" USING btree ("token_hash");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index revoked_tokens_token_hash_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index revoked_tokens_token_hash_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index sessions_token_hash_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index sessions_token_hash_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" USING btree ("username");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index users_username_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index users_username_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index users_email_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index users_email_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_unique" ON "system_settings" USING btree ("key");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index system_settings_key_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index system_settings_key_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "creator_profiles_user_id_unique" ON "creator_profiles" USING btree ("user_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index creator_profiles_user_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index creator_profiles_user_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "post_trust_scores_post_id_unique" ON "post_trust_scores" USING btree ("post_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index post_trust_scores_post_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index post_trust_scores_post_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "user_trust_scores_user_id_unique" ON "user_trust_scores" USING btree ("user_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index user_trust_scores_user_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index user_trust_scores_user_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "post_topics_post_id_topic_id_unique" ON "post_topics" USING btree ("post_id","topic_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index post_topics_post_id_topic_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index post_topics_post_id_topic_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "topic_follows_user_id_topic_id_unique" ON "topic_follows" USING btree ("user_id","topic_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index topic_follows_user_id_topic_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index topic_follows_user_id_topic_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "topics_name_unique" ON "topics" USING btree ("name");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index topics_name_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index topics_name_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "topics_slug_unique" ON "topics" USING btree ("slug");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index topics_slug_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index topics_slug_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "collection_posts_collection_id_post_id_unique" ON "collection_posts" USING btree ("collection_id","post_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index collection_posts_collection_id_post_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index collection_posts_collection_id_post_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_unique" ON "api_keys" USING btree ("key_hash");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index api_keys_key_hash_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index api_keys_key_hash_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "invite_codes_code_unique" ON "invite_codes" USING btree ("code");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index invite_codes_code_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index invite_codes_code_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "featured_slots_slot_key_unique" ON "featured_slots" USING btree ("slot_key");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index featured_slots_slot_key_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index featured_slots_slot_key_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "passkeys_credential_id_unique" ON "passkeys" USING btree ("credential_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index passkeys_credential_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index passkeys_credential_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "creator_availability_user_id_unique" ON "creator_availability" USING btree ("user_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index creator_availability_user_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index creator_availability_user_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "creator_payment_transactions_tx_ref_unique" ON "creator_payment_transactions" USING btree ("tx_ref");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index creator_payment_transactions_tx_ref_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index creator_payment_transactions_tx_ref_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "creator_payment_transactions_transaction_id_unique" ON "creator_payment_transactions" USING btree ("transaction_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index creator_payment_transactions_transaction_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index creator_payment_transactions_transaction_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "user_taste_profiles_user_id_unique" ON "user_taste_profiles" USING btree ("user_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index user_taste_profiles_user_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index user_taste_profiles_user_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "library_entries_slug_unique" ON "library_entries" USING btree ("slug");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index library_entries_slug_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index library_entries_slug_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "muted_users_muter_id_muted_id_unique" ON "muted_users" USING btree ("muter_id","muted_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index muted_users_muter_id_muted_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index muted_users_muter_id_muted_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_follows_follower_id" ON "follows" USING btree ("follower_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_follows_follower_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_follows_following_id" ON "follows" USING btree ("following_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_follows_following_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "idx_follows_unique" ON "follows" USING btree ("follower_id","following_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index idx_follows_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index idx_follows_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_revoked_tokens_expires_at" ON "revoked_tokens" USING btree ("expires_at");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_revoked_tokens_expires_at: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "users_public_id_unique" ON "users" USING btree ("public_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index users_public_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index users_public_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_comment_likes_comment_id" ON "comment_likes" USING btree ("comment_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_comment_likes_comment_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_comment_likes_user_id" ON "comment_likes" USING btree ("user_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_comment_likes_user_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_comments_post_id" ON "comments" USING btree ("post_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_comments_post_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_comments_author_id" ON "comments" USING btree ("author_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_comments_author_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_likes_post_id" ON "likes" USING btree ("post_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_likes_post_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_likes_user_id" ON "likes" USING btree ("user_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_likes_user_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "likes_user_post_unique" ON "likes" USING btree ("post_id","user_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index likes_user_post_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index likes_user_post_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_post_shares_post_id" ON "post_shares" USING btree ("post_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_post_shares_post_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_posts_author_id" ON "posts" USING btree ("author_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_posts_author_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_posts_created_at" ON "posts" USING btree ("created_at");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_posts_created_at: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_posts_is_published" ON "posts" USING btree ("is_published");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_posts_is_published: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_posts_is_deleted" ON "posts" USING btree ("is_deleted");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_posts_is_deleted: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_posts_type" ON "posts" USING btree ("type");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_posts_type: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_posts_scheduled_at" ON "posts" USING btree ("scheduled_at");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_posts_scheduled_at: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "posts_public_id_unique" ON "posts" USING btree ("public_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index posts_public_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index posts_public_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_reposts_post_id" ON "reposts" USING btree ("post_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_reposts_post_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_reposts_user_id" ON "reposts" USING btree ("user_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_reposts_user_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_saved_posts_user_id" ON "saved_posts" USING btree ("user_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_saved_posts_user_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_saved_posts_post_id" ON "saved_posts" USING btree ("post_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_saved_posts_post_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "saved_posts_user_post_unique" ON "saved_posts" USING btree ("user_id","post_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index saved_posts_user_post_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index saved_posts_user_post_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "group_activity_logs_group_created_idx" ON "group_activity_logs" USING btree ("group_id","created_at");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index group_activity_logs_group_created_idx: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "group_bans_group_user_unique" ON "group_bans" USING btree ("group_id","user_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index group_bans_group_user_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index group_bans_group_user_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "group_invites_code_unique" ON "group_invites" USING btree ("invite_code");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index group_invites_code_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index group_invites_code_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "group_invites_group_status_idx" ON "group_invites" USING btree ("group_id","status");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index group_invites_group_status_idx: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "group_join_requests_group_user_unique" ON "group_join_requests" USING btree ("group_id","user_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index group_join_requests_group_user_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index group_join_requests_group_user_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "group_members_group_user_unique" ON "group_members" USING btree ("group_id","user_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index group_members_group_user_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index group_members_group_user_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "group_members_group_status_idx" ON "group_members" USING btree ("group_id","status");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index group_members_group_status_idx: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "group_post_details_post_unique" ON "group_post_details" USING btree ("post_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index group_post_details_post_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index group_post_details_post_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "group_post_details_group_created_idx" ON "group_post_details" USING btree ("group_id","created_at");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index group_post_details_group_created_idx: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "groups_slug_unique" ON "groups" USING btree ("slug");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index groups_slug_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index groups_slug_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "groups_public_id_unique" ON "groups" USING btree ("public_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index groups_public_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index groups_public_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "opportunity_applications_job_applicant_unique" ON "opportunity_applications" USING btree ("job_id","applicant_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index opportunity_applications_job_applicant_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index opportunity_applications_job_applicant_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications" USING btree ("user_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_notifications_user_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_notifications_is_read" ON "notifications" USING btree ("is_read");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_notifications_is_read: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_notifications_created_at" ON "notifications" USING btree ("created_at");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_notifications_created_at: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_rooms_request_unique" ON "collaboration_rooms" USING btree ("request_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index collaboration_rooms_request_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index collaboration_rooms_request_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "collaboration_rooms_public_id_unique" ON "collaboration_rooms" USING btree ("public_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index collaboration_rooms_public_id_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index collaboration_rooms_public_id_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_unique" ON "push_subscriptions" USING btree ("endpoint");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index push_subscriptions_endpoint_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index push_subscriptions_endpoint_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "achievements_key_unique" ON "achievements" USING btree ("key");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index achievements_key_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index achievements_key_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "user_achievements_user_achievement_unique" ON "user_achievements" USING btree ("user_id","achievement_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index user_achievements_user_achievement_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index user_achievements_user_achievement_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "writing_activity_user_post_date_unique" ON "writing_activity" USING btree ("user_id","post_id","write_date");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index writing_activity_user_post_date_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index writing_activity_user_post_date_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "reading_progress_user_post_idx" ON "reading_progress" USING btree ("user_id","post_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index reading_progress_user_post_idx: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index reading_progress_user_post_idx: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "poll_votes_unique_idx" ON "poll_votes" USING btree ("poll_id","user_id","option_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index poll_votes_unique_idx: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index poll_votes_unique_idx: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "post_fingerprints_shingle_idx" ON "post_fingerprints" USING btree ("shingle");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index post_fingerprints_shingle_idx: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "post_fingerprints_post_idx" ON "post_fingerprints" USING btree ("post_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index post_fingerprints_post_idx: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "reading_activity_user_date_idx" ON "reading_activity" USING btree ("user_id","read_date");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index reading_activity_user_date_idx: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "reading_streaks_user_idx" ON "reading_streaks" USING btree ("user_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index reading_streaks_user_idx: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index reading_streaks_user_idx: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_login_email_challenges_user_expiry" ON "login_email_challenges" USING btree ("user_id","expires_at");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_login_email_challenges_user_expiry: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "boost_requests_flw_tx_ref_unique" ON "boost_requests" USING btree ("flw_tx_ref");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index boost_requests_flw_tx_ref_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index boost_requests_flw_tx_ref_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_commissions_to_creator" ON "commission_requests" USING btree ("to_creator_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_commissions_to_creator: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_commissions_from_user" ON "commission_requests" USING btree ("from_user_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_commissions_from_user: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_commissions_status" ON "commission_requests" USING btree ("status");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_commissions_status: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_availability_user" ON "creator_availability" USING btree ("user_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_availability_user: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_availability_status" ON "creator_availability" USING btree ("status");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_availability_status: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_creator_payment_buyer" ON "creator_payment_transactions" USING btree ("buyer_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_creator_payment_buyer: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_creator_payment_creator" ON "creator_payment_transactions" USING btree ("creator_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_creator_payment_creator: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_creator_payment_status" ON "creator_payment_transactions" USING btree ("status");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_creator_payment_status: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "creator_sub_unique" ON "creator_subscriptions" USING btree ("subscriber_id","creator_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index creator_sub_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index creator_sub_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "paid_post_access_unique" ON "paid_post_access" USING btree ("post_id","user_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index paid_post_access_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index paid_post_access_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_service_listings_creator_id" ON "service_listings" USING btree ("creator_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_service_listings_creator_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_service_listings_active" ON "service_listings" USING btree ("is_active");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_service_listings_active: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "skill_endorsement_unique" ON "skill_endorsements" USING btree ("from_user_id","to_user_id","skill");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index skill_endorsement_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index skill_endorsement_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_endorsements_to_user" ON "skill_endorsements" USING btree ("to_user_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_endorsements_to_user: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_endorsements_to_user_skill" ON "skill_endorsements" USING btree ("to_user_id","skill");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_endorsements_to_user_skill: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_endorsements_from_user" ON "skill_endorsements" USING btree ("from_user_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_endorsements_from_user: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "creator_similarity_unique" ON "creator_similarity" USING btree ("creator_a_id","creator_b_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index creator_similarity_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index creator_similarity_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "user_creator_affinity_unique" ON "user_creator_affinity" USING btree ("user_id","creator_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index user_creator_affinity_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index user_creator_affinity_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "user_topic_affinity_unique" ON "user_topic_affinity" USING btree ("user_id","topic_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index user_topic_affinity_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index user_topic_affinity_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_user_topic_affinity_user" ON "user_topic_affinity" USING btree ("user_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_user_topic_affinity_user: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_user_topic_affinity_score" ON "user_topic_affinity" USING btree ("affinity_score");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_user_topic_affinity_score: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_library_author" ON "library_entries" USING btree ("author_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_library_author: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_library_category" ON "library_entries" USING btree ("category");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_library_category: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_library_public" ON "library_entries" USING btree ("is_public");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_library_public: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_library_featured" ON "library_entries" USING btree ("is_featured");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_library_featured: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "idx_library_slug" ON "library_entries" USING btree ("slug");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index idx_library_slug: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index idx_library_slug: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "idx_library_saves_unique" ON "library_saves" USING btree ("user_id","entry_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index idx_library_saves_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index idx_library_saves_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "chain_entries_chain_post_idx" ON "chain_entries" USING btree ("chain_id","post_id");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index chain_entries_chain_post_idx: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index chain_entries_chain_post_idx: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_chain_entries_chain_id" ON "chain_entries" USING btree ("chain_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_chain_entries_chain_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_chain_entries_author_id" ON "chain_entries" USING btree ("author_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_chain_entries_author_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_chains_creator_id" ON "chains" USING btree ("creator_id");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_chains_creator_id: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_chains_is_public" ON "chains" USING btree ("is_public");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_chains_is_public: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "idx_chains_is_complete" ON "chains" USING btree ("is_complete");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index idx_chains_is_complete: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "spam_review_flags_user_rule_unique" ON "spam_review_flags" USING btree ("user_id","rule_key");
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index spam_review_flags_user_rule_unique: existing rows contain duplicate values';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped unique index spam_review_flags_user_rule_unique: %', SQLERRM;
END
$schema_sync$;

DO $schema_sync$
BEGIN
  CREATE INDEX IF NOT EXISTS "spam_review_flags_status_created_idx" ON "spam_review_flags" USING btree ("status","created_at");
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped index spam_review_flags_status_created_idx: %', SQLERRM;
END
$schema_sync$;

COMMIT;
