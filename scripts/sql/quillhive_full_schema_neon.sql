-- Full QuillHive schema generated from packages/utils/db/src/schema/index.ts.
-- Run this file only against a fresh, empty Neon database.
-- For an existing database, use the project's migrations or focused upgrade scripts.
BEGIN;

CREATE TABLE "blocked_email_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"domain" text NOT NULL,
	"reason" text NOT NULL,
	"reputation_score" integer NOT NULL,
	"ip_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "education_history" (
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

CREATE TABLE "email_verification_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" integer NOT NULL,
	"following_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "login_events" (
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

CREATE TABLE "revoked_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "revoked_tokens_token_hash_unique" UNIQUE("token_hash")
);

CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);

CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
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

CREATE TABLE "work_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"organization" text NOT NULL,
	"start_year" integer NOT NULL,
	"end_year" integer,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "comment_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "comments" (
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

CREATE TABLE "likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "post_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer,
	"source" text,
	"click_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
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

CREATE TABLE "reposts" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "saved_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "conversation_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"is_group" boolean DEFAULT false NOT NULL,
	"group_name" text,
	"opportunity_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"seen_at" timestamp
);

CREATE TABLE "conversation_payment_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"proposer_id" integer NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"note" text,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "group_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"actor_id" integer,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "group_bans" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"banned_by" integer NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "group_join_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"screening_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"muted_until" timestamp,
	"trust_score_at_join" integer
);

CREATE TABLE "group_pinned_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"pinned_by" integer NOT NULL,
	"pinned_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "group_post_details" (
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

CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
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

CREATE TABLE "jobs" (
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

CREATE TABLE "opportunity_applications" (
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

CREATE TABLE "notifications" (
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

CREATE TABLE "appreciations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "moderation_strikes" (
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

CREATE TABLE "reports" (
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

CREATE TABLE "admin_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);

CREATE TABLE "portfolio_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"media_url" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "creator_profiles" (
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

CREATE TABLE "collaboration_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "collaboration_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"created_by_id" integer NOT NULL,
	"title" text NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"split_suggestion" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);

CREATE TABLE "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'Award' NOT NULL,
	"category" text DEFAULT 'milestone' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"achievement_id" integer NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "writing_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"write_date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "writing_streaks" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_write_date" text,
	"total_days_written" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "post_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"viewer_id" integer,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"country" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "uploaded_files" (
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

CREATE TABLE "safety_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"muted_words" text DEFAULT '[]' NOT NULL,
	"blocked_user_ids" text DEFAULT '[]' NOT NULL,
	"content_filter" text DEFAULT 'standard' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "support_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"file_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"severity" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "behavior_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"severity" integer DEFAULT 1 NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "post_trust_scores" (
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

CREATE TABLE "reputation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"score_change" real DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_trust_scores" (
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

CREATE TABLE "post_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_topics_post_id_topic_id_unique" UNIQUE("post_id","topic_id")
);

CREATE TABLE "topic_follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topic_follows_user_id_topic_id_unique" UNIQUE("user_id","topic_id")
);

CREATE TABLE "topics" (
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

CREATE TABLE "mentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer,
	"mentioned_user_id" integer NOT NULL,
	"mentioning_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "translation_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_hash" text NOT NULL,
	"source_lang" text DEFAULT 'en' NOT NULL,
	"target_lang" text NOT NULL,
	"translated_text" text NOT NULL,
	"hit_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "series" (
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

CREATE TABLE "collection_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_posts_collection_id_post_id_unique" UNIQUE("collection_id","post_id")
);

CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"post_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "income_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"source" text NOT NULL,
	"description" text,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "post_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"editor_id" integer NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"excerpt" text,
	"change_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "reading_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"percent" real DEFAULT 0 NOT NULL,
	"read_time_ms" integer DEFAULT 0 NOT NULL,
	"last_read_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "poll_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "poll_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "polls" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"question" text NOT NULL,
	"allow_multiple" boolean DEFAULT false NOT NULL,
	"closes_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "post_fingerprints" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"shingle" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "reading_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"read_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "reading_streaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_read_date" date,
	"total_days_read" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "moderation_rules" (
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

CREATE TABLE "admin_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"note" text NOT NULL,
	"is_internal" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "api_keys" (
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

CREATE TABLE "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhook_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"response_status" integer,
	"response_body" text,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"succeeded" boolean DEFAULT false NOT NULL
);

CREATE TABLE "webhooks" (
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

CREATE TABLE "invite_codes" (
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

CREATE TABLE "featured_slots" (
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

CREATE TABLE "magic_link_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "oauth_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"email" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "passkeys" (
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

CREATE TABLE "challenge_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "challenges" (
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

CREATE TABLE "boost_requests" (
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

CREATE TABLE "commission_requests" (
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

CREATE TABLE "creator_availability" (
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

CREATE TABLE "creator_earnings" (
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

CREATE TABLE "creator_payment_transactions" (
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

CREATE TABLE "creator_subscription_plans" (
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

CREATE TABLE "creator_subscriptions" (
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

CREATE TABLE "creator_tips" (
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

CREATE TABLE "paid_post_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);

CREATE TABLE "service_listings" (
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

CREATE TABLE "skill_endorsements" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_user_id" integer NOT NULL,
	"skill" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "creator_similarity" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_a_id" integer NOT NULL,
	"creator_b_id" integer NOT NULL,
	"similarity_score" real DEFAULT 0 NOT NULL,
	"shared_topic_ids" text DEFAULT '[]' NOT NULL,
	"audience_overlap" real DEFAULT 0 NOT NULL,
	"style_score" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_creator_affinity" (
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

CREATE TABLE "user_taste_profiles" (
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

CREATE TABLE "user_topic_affinity" (
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

CREATE TABLE "library_entries" (
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

CREATE TABLE "library_saves" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "chain_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"position" integer NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "chains" (
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

CREATE TABLE "profile_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_user_id" integer NOT NULL,
	"viewer_user_id" integer,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "muted_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "muted_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"muter_id" integer NOT NULL,
	"muted_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "muted_users_muter_id_muted_id_unique" UNIQUE("muter_id","muted_id")
);

ALTER TABLE "education_history" ADD CONSTRAINT "education_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "work_history" ADD CONSTRAINT "work_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "likes" ADD CONSTRAINT "likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "post_shares" ADD CONSTRAINT "post_shares_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "post_shares" ADD CONSTRAINT "post_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "posts" ADD CONSTRAINT "posts_quoted_post_id_posts_id_fk" FOREIGN KEY ("quoted_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "conversation_payment_proposals" ADD CONSTRAINT "conversation_payment_proposals_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "conversation_payment_proposals" ADD CONSTRAINT "conversation_payment_proposals_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "group_activity_logs" ADD CONSTRAINT "group_activity_logs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "group_activity_logs" ADD CONSTRAINT "group_activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "group_bans" ADD CONSTRAINT "group_bans_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "group_bans" ADD CONSTRAINT "group_bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "group_bans" ADD CONSTRAINT "group_bans_banned_by_users_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "group_pinned_posts" ADD CONSTRAINT "group_pinned_posts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "group_pinned_posts" ADD CONSTRAINT "group_pinned_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "group_pinned_posts" ADD CONSTRAINT "group_pinned_posts_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "group_post_details" ADD CONSTRAINT "group_post_details_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "group_post_details" ADD CONSTRAINT "group_post_details_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "groups" ADD CONSTRAINT "groups_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "opportunity_applications" ADD CONSTRAINT "opportunity_applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "opportunity_applications" ADD CONSTRAINT "opportunity_applications_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "appreciations" ADD CONSTRAINT "appreciations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "appreciations" ADD CONSTRAINT "appreciations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "moderation_strikes" ADD CONSTRAINT "moderation_strikes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "moderation_strikes" ADD CONSTRAINT "moderation_strikes_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "moderation_strikes" ADD CONSTRAINT "moderation_strikes_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "collaboration_rooms" ADD CONSTRAINT "collaboration_rooms_request_id_collaboration_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."collaboration_requests"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "collaboration_rooms" ADD CONSTRAINT "collaboration_rooms_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "writing_activity" ADD CONSTRAINT "writing_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "writing_activity" ADD CONSTRAINT "writing_activity_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "writing_streaks" ADD CONSTRAINT "writing_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "post_views" ADD CONSTRAINT "post_views_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "post_views" ADD CONSTRAINT "post_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "safety_preferences" ADD CONSTRAINT "safety_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_file_id_uploaded_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "behavior_events" ADD CONSTRAINT "behavior_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "post_trust_scores" ADD CONSTRAINT "post_trust_scores_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_trust_scores" ADD CONSTRAINT "user_trust_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "post_topics" ADD CONSTRAINT "post_topics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "post_topics" ADD CONSTRAINT "post_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioning_user_id_users_id_fk" FOREIGN KEY ("mentioning_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "series" ADD CONSTRAINT "series_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "collection_posts" ADD CONSTRAINT "collection_posts_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "collection_posts" ADD CONSTRAINT "collection_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "income_logs" ADD CONSTRAINT "income_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "polls" ADD CONSTRAINT "polls_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "polls" ADD CONSTRAINT "polls_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "post_fingerprints" ADD CONSTRAINT "post_fingerprints_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reading_activity" ADD CONSTRAINT "reading_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reading_streaks" ADD CONSTRAINT "reading_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "moderation_rules" ADD CONSTRAINT "moderation_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "featured_slots" ADD CONSTRAINT "featured_slots_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_granted_by_admin_id_users_id_fk" FOREIGN KEY ("granted_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "boost_requests" ADD CONSTRAINT "boost_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_to_creator_id_users_id_fk" FOREIGN KEY ("to_creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_service_listing_id_service_listings_id_fk" FOREIGN KEY ("service_listing_id") REFERENCES "public"."service_listings"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_availability" ADD CONSTRAINT "creator_availability_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_service_listing_id_service_listings_id_fk" FOREIGN KEY ("service_listing_id") REFERENCES "public"."service_listings"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_payment_transactions" ADD CONSTRAINT "creator_payment_transactions_commission_request_id_commission_requests_id_fk" FOREIGN KEY ("commission_request_id") REFERENCES "public"."commission_requests"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_subscription_plans" ADD CONSTRAINT "creator_subscription_plans_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_subscriptions" ADD CONSTRAINT "creator_subscriptions_subscriber_id_users_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_subscriptions" ADD CONSTRAINT "creator_subscriptions_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_subscriptions" ADD CONSTRAINT "creator_subscriptions_plan_id_creator_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."creator_subscription_plans"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_tips" ADD CONSTRAINT "creator_tips_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_tips" ADD CONSTRAINT "creator_tips_to_creator_id_users_id_fk" FOREIGN KEY ("to_creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_tips" ADD CONSTRAINT "creator_tips_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "paid_post_access" ADD CONSTRAINT "paid_post_access_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "paid_post_access" ADD CONSTRAINT "paid_post_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_similarity" ADD CONSTRAINT "creator_similarity_creator_a_id_users_id_fk" FOREIGN KEY ("creator_a_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "creator_similarity" ADD CONSTRAINT "creator_similarity_creator_b_id_users_id_fk" FOREIGN KEY ("creator_b_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_creator_affinity" ADD CONSTRAINT "user_creator_affinity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_creator_affinity" ADD CONSTRAINT "user_creator_affinity_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_taste_profiles" ADD CONSTRAINT "user_taste_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_topic_affinity" ADD CONSTRAINT "user_topic_affinity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_topic_affinity" ADD CONSTRAINT "user_topic_affinity_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "library_saves" ADD CONSTRAINT "library_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "library_saves" ADD CONSTRAINT "library_saves_entry_id_library_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."library_entries"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chain_entries" ADD CONSTRAINT "chain_entries_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chain_entries" ADD CONSTRAINT "chain_entries_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chain_entries" ADD CONSTRAINT "chain_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chains" ADD CONSTRAINT "chains_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_profile_user_id_users_id_fk" FOREIGN KEY ("profile_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewer_user_id_users_id_fk" FOREIGN KEY ("viewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "muted_users" ADD CONSTRAINT "muted_users_muter_id_users_id_fk" FOREIGN KEY ("muter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "muted_users" ADD CONSTRAINT "muted_users_muted_id_users_id_fk" FOREIGN KEY ("muted_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "idx_follows_follower_id" ON "follows" USING btree ("follower_id");
CREATE INDEX "idx_follows_following_id" ON "follows" USING btree ("following_id");
CREATE UNIQUE INDEX "idx_follows_unique" ON "follows" USING btree ("follower_id","following_id");
CREATE INDEX "idx_revoked_tokens_expires_at" ON "revoked_tokens" USING btree ("expires_at");
CREATE INDEX "idx_comment_likes_comment_id" ON "comment_likes" USING btree ("comment_id");
CREATE INDEX "idx_comment_likes_user_id" ON "comment_likes" USING btree ("user_id");
CREATE INDEX "idx_comments_post_id" ON "comments" USING btree ("post_id");
CREATE INDEX "idx_comments_author_id" ON "comments" USING btree ("author_id");
CREATE INDEX "idx_likes_post_id" ON "likes" USING btree ("post_id");
CREATE INDEX "idx_likes_user_id" ON "likes" USING btree ("user_id");
CREATE UNIQUE INDEX "likes_user_post_unique" ON "likes" USING btree ("post_id","user_id");
CREATE INDEX "idx_post_shares_post_id" ON "post_shares" USING btree ("post_id");
CREATE INDEX "idx_posts_author_id" ON "posts" USING btree ("author_id");
CREATE INDEX "idx_posts_created_at" ON "posts" USING btree ("created_at");
CREATE INDEX "idx_posts_is_published" ON "posts" USING btree ("is_published");
CREATE INDEX "idx_posts_is_deleted" ON "posts" USING btree ("is_deleted");
CREATE INDEX "idx_posts_type" ON "posts" USING btree ("type");
CREATE INDEX "idx_posts_scheduled_at" ON "posts" USING btree ("scheduled_at");
CREATE INDEX "idx_reposts_post_id" ON "reposts" USING btree ("post_id");
CREATE INDEX "idx_reposts_user_id" ON "reposts" USING btree ("user_id");
CREATE INDEX "idx_saved_posts_user_id" ON "saved_posts" USING btree ("user_id");
CREATE INDEX "idx_saved_posts_post_id" ON "saved_posts" USING btree ("post_id");
CREATE UNIQUE INDEX "saved_posts_user_post_unique" ON "saved_posts" USING btree ("user_id","post_id");
CREATE INDEX "group_activity_logs_group_created_idx" ON "group_activity_logs" USING btree ("group_id","created_at");
CREATE UNIQUE INDEX "group_bans_group_user_unique" ON "group_bans" USING btree ("group_id","user_id");
CREATE UNIQUE INDEX "group_join_requests_group_user_unique" ON "group_join_requests" USING btree ("group_id","user_id");
CREATE UNIQUE INDEX "group_members_group_user_unique" ON "group_members" USING btree ("group_id","user_id");
CREATE INDEX "group_members_group_status_idx" ON "group_members" USING btree ("group_id","status");
CREATE UNIQUE INDEX "group_post_details_post_unique" ON "group_post_details" USING btree ("post_id");
CREATE INDEX "group_post_details_group_created_idx" ON "group_post_details" USING btree ("group_id","created_at");
CREATE UNIQUE INDEX "groups_slug_unique" ON "groups" USING btree ("slug");
CREATE UNIQUE INDEX "opportunity_applications_job_applicant_unique" ON "opportunity_applications" USING btree ("job_id","applicant_id");
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");
CREATE INDEX "idx_notifications_is_read" ON "notifications" USING btree ("is_read");
CREATE INDEX "idx_notifications_created_at" ON "notifications" USING btree ("created_at");
CREATE UNIQUE INDEX "collaboration_rooms_request_unique" ON "collaboration_rooms" USING btree ("request_id");
CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique" ON "push_subscriptions" USING btree ("endpoint");
CREATE UNIQUE INDEX "achievements_key_unique" ON "achievements" USING btree ("key");
CREATE UNIQUE INDEX "user_achievements_user_achievement_unique" ON "user_achievements" USING btree ("user_id","achievement_id");
CREATE UNIQUE INDEX "writing_activity_user_post_date_unique" ON "writing_activity" USING btree ("user_id","post_id","write_date");
CREATE UNIQUE INDEX "reading_progress_user_post_idx" ON "reading_progress" USING btree ("user_id","post_id");
CREATE UNIQUE INDEX "poll_votes_unique_idx" ON "poll_votes" USING btree ("poll_id","user_id","option_id");
CREATE INDEX "post_fingerprints_shingle_idx" ON "post_fingerprints" USING btree ("shingle");
CREATE INDEX "post_fingerprints_post_idx" ON "post_fingerprints" USING btree ("post_id");
CREATE INDEX "reading_activity_user_date_idx" ON "reading_activity" USING btree ("user_id","read_date");
CREATE UNIQUE INDEX "reading_streaks_user_idx" ON "reading_streaks" USING btree ("user_id");
CREATE UNIQUE INDEX "boost_requests_flw_tx_ref_unique" ON "boost_requests" USING btree ("flw_tx_ref");
CREATE INDEX "idx_commissions_to_creator" ON "commission_requests" USING btree ("to_creator_id");
CREATE INDEX "idx_commissions_from_user" ON "commission_requests" USING btree ("from_user_id");
CREATE INDEX "idx_commissions_status" ON "commission_requests" USING btree ("status");
CREATE INDEX "idx_availability_user" ON "creator_availability" USING btree ("user_id");
CREATE INDEX "idx_availability_status" ON "creator_availability" USING btree ("status");
CREATE INDEX "idx_creator_payment_buyer" ON "creator_payment_transactions" USING btree ("buyer_id");
CREATE INDEX "idx_creator_payment_creator" ON "creator_payment_transactions" USING btree ("creator_id");
CREATE INDEX "idx_creator_payment_status" ON "creator_payment_transactions" USING btree ("status");
CREATE UNIQUE INDEX "creator_sub_unique" ON "creator_subscriptions" USING btree ("subscriber_id","creator_id");
CREATE UNIQUE INDEX "paid_post_access_unique" ON "paid_post_access" USING btree ("post_id","user_id");
CREATE INDEX "idx_service_listings_creator_id" ON "service_listings" USING btree ("creator_id");
CREATE INDEX "idx_service_listings_active" ON "service_listings" USING btree ("is_active");
CREATE UNIQUE INDEX "skill_endorsement_unique" ON "skill_endorsements" USING btree ("from_user_id","to_user_id","skill");
CREATE INDEX "idx_endorsements_to_user" ON "skill_endorsements" USING btree ("to_user_id");
CREATE INDEX "idx_endorsements_to_user_skill" ON "skill_endorsements" USING btree ("to_user_id","skill");
CREATE INDEX "idx_endorsements_from_user" ON "skill_endorsements" USING btree ("from_user_id");
CREATE UNIQUE INDEX "creator_similarity_unique" ON "creator_similarity" USING btree ("creator_a_id","creator_b_id");
CREATE UNIQUE INDEX "user_creator_affinity_unique" ON "user_creator_affinity" USING btree ("user_id","creator_id");
CREATE UNIQUE INDEX "user_topic_affinity_unique" ON "user_topic_affinity" USING btree ("user_id","topic_id");
CREATE INDEX "idx_user_topic_affinity_user" ON "user_topic_affinity" USING btree ("user_id");
CREATE INDEX "idx_user_topic_affinity_score" ON "user_topic_affinity" USING btree ("affinity_score");
CREATE INDEX "idx_library_author" ON "library_entries" USING btree ("author_id");
CREATE INDEX "idx_library_category" ON "library_entries" USING btree ("category");
CREATE INDEX "idx_library_public" ON "library_entries" USING btree ("is_public");
CREATE INDEX "idx_library_featured" ON "library_entries" USING btree ("is_featured");
CREATE UNIQUE INDEX "idx_library_slug" ON "library_entries" USING btree ("slug");
CREATE UNIQUE INDEX "idx_library_saves_unique" ON "library_saves" USING btree ("user_id","entry_id");
CREATE UNIQUE INDEX "chain_entries_chain_post_idx" ON "chain_entries" USING btree ("chain_id","post_id");
CREATE INDEX "idx_chain_entries_chain_id" ON "chain_entries" USING btree ("chain_id");
CREATE INDEX "idx_chain_entries_author_id" ON "chain_entries" USING btree ("author_id");
CREATE INDEX "idx_chains_creator_id" ON "chains" USING btree ("creator_id");
CREATE INDEX "idx_chains_is_public" ON "chains" USING btree ("is_public");
CREATE INDEX "idx_chains_is_complete" ON "chains" USING btree ("is_complete");
COMMIT;
