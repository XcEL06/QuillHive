import { Router, type IRouter } from "express";

// ─── Unchanged routes ─────────────────────────────────────────────────────────
import healthRouter from "./health";
import groupsRouter from "./groups";
import jobsRouter from "./jobs";
import notificationsRouter from "./notifications";
import { pushRouter } from "../features/notifications/push.routes";
import { achievementsRouter } from "../features/achievements/achievement.routes";
import { writingStreaksRouter } from "../features/discovery/writingStreaks.routes";
import aiRouter from "./ai";
import appreciationsRouter from "./appreciations";
import adminRouter from "./admin";

// ─── Feature-based routes ─────────────────────────────────────────────────────
import { authRouter, usersRouter } from "../features/profiles/profile.routes";
import { postsRouter, feedRouter, commentsRouter, sparksRouter } from "../features/posts/post.routes";
import { messagesRouter } from "../features/messaging/messaging.routes";
import { galleryRouter } from "../features/gallery/gallery.routes";
import { collaborationRouter } from "../features/collaboration/collaboration.routes";
import { analyticsRouter } from "../features/analytics/analytics.routes";
import { emailRouter } from "../features/email/email.routes";
import { languagesRouter, userLanguageRouter } from "../features/languages/languages.routes";
import { uploadRouter } from "../features/uploads/upload.routes";
import { supportRouter } from "../features/support/support.routes";
import { publicSupportRouter } from "../features/support/public.routes";
import { trustRouter, adminTrustRouter } from "../features/trust/trust.routes";
import { topicsRouter, topicFeedRouter } from "../features/topics/topics.routes";
import { mentionsRouter } from "../features/mentions/mentions.routes";
import { seriesRouter } from "../features/series/series.routes";
import { seriesNavRouter } from "../features/series/seriesNav.routes";
import { strikesRouter } from "../features/strikes/strikes.routes";
import { groupAdminRouter } from "../features/groups/groupAdmin.routes";
import { collectionsRouter } from "../features/collections/collections.routes";
import { incomeRouter } from "../features/income/income.routes";
import { embedRouter } from "../features/embed/embed.routes";
import { twofaRouter } from "../features/twofa/twofa.routes";
import { postVersionsRouter } from "../features/posts/postVersions.routes";
import * as Sessions from "../features/security/sessions.controller";
import { readingProgressRouter } from "../features/reader/readingProgress.routes";
import { highlightsRouter } from "../features/highlights/highlights.routes";
import { pollsRouter } from "../features/polls/polls.routes";
import { blocksRouter } from "../features/safety/blocks.routes";
import { safetyRouter } from "../features/safety/safety.routes";
import { discoveryRouter } from "../features/discovery/discovery.routes";
import { publicApiRouter, apiKeysAdminRouter } from "../features/distribution/publicApi.routes";
import { webhooksRouter } from "../features/distribution/webhooks.routes";
import { monitoringRouter } from "../features/admin/monitoring.routes";
import { adminExtensionsRouter, publicFeaturedRouter } from "../features/admin/extensions.routes";
import { invitesRouter } from "../features/invites/invites.routes";
import { magicLinkRouter } from "../features/auth/magicLink.routes";
import { passkeyRouter } from "../features/auth/passkey.routes";
import { oauthRouter } from "../features/auth/oauth.routes";
import { privacyRouter } from "../features/profiles/privacy.routes";
import { originalityRouter } from "../features/safety/originality.routes";
import { challengesRouter } from "../features/challenges/challenges.routes";
import { boostRouter } from "../features/boost/boost.routes";
import { libraryRouter } from "../features/library/library.routes";
import { notificationPrefsRouter } from "../features/notifications/notificationPrefs.routes";
import { paymentRouter } from "../features/payments/payment.routes";
import { serviceListingsRouter, endorsementsRouter } from "../features/creator-economy/serviceListing.routes";
import { opportunitiesRouter } from "../features/creator-economy/opportunities.routes";
import { officialPostsRouter, officialPublicRouter } from "../features/official/officialPosts.routes";
import { chainsRouter } from "../features/chains/chains.routes";
import { carouselRouter } from "../features/carousel/carousel.routes";
import { masterAdminRouter } from "../features/admin/master.routes";
import { spamReviewRouter } from "../features/admin/spamReview.routes";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/posts", postsRouter);
router.use("/sparks", sparksRouter);
router.use("/comments", commentsRouter);
router.use("/messages", messagesRouter);
router.use("/gallery", galleryRouter);
router.use("/collaboration", collaborationRouter);
router.use("/analytics", analyticsRouter);
router.use("/email", emailRouter);
router.use("/languages", languagesRouter);
router.use("/user", userLanguageRouter);
router.use("/upload", uploadRouter);
router.use("/file", uploadRouter);
router.use("/support", publicSupportRouter);
router.use("/support", supportRouter);
router.use("/groups", groupsRouter);
router.use("/jobs", jobsRouter);
router.use("/notifications", notificationsRouter);
router.use("/push", pushRouter);
router.use("/achievements", achievementsRouter);
router.use("/writing-streaks", writingStreaksRouter);
router.use("/ai", aiRouter);
router.use(appreciationsRouter);
router.use("/admin", adminRouter);
router.use("/admin/master", masterAdminRouter);
router.use("/admin/spam-review", spamReviewRouter);
router.use("/admin/trust", adminTrustRouter);
router.use("/trust", trustRouter);
router.use("/topics", topicsRouter);
router.use(feedRouter);
router.use(topicFeedRouter);
router.use("/mentions", mentionsRouter);
router.use("/series", seriesRouter);
router.use(seriesNavRouter);
router.use("/strikes", strikesRouter);
router.use("/groups", groupAdminRouter);
router.use("/collections", collectionsRouter);
router.use("/income", incomeRouter);
router.use("/embed", embedRouter);
router.use("/auth/2fa", twofaRouter);

// Login activity & sessions
router.get("/auth/sessions", Sessions.listMySessions);
router.get("/auth/login-activity", Sessions.listMyLoginActivity);
router.post("/auth/sessions/logout-all", Sessions.revokeAllMySessions);

// Post version history
router.use(postVersionsRouter);

// Reader experience
router.use("/reading-progress", readingProgressRouter);
router.use("/highlights", highlightsRouter);
router.use("/polls", pollsRouter);

// Trust & safety
router.use("/blocks", blocksRouter);
router.use("/safety", safetyRouter);

// Discovery & recommendations (Phase 3)
router.use(discoveryRouter);

// Public read-only API (API key auth) and owner key management
router.use("/v1/public", publicApiRouter);
router.use("/me/api-keys", apiKeysAdminRouter);

// Outbound webhooks (per-user)
router.use("/me/webhooks", webhooksRouter);

// Owner intelligence - admin-only
router.use("/admin/monitoring", monitoringRouter);

// Admin extensions: job/post/group moderation, featured slots
router.use("/admin", adminExtensionsRouter);

// Public featured slots (no auth)
router.use(publicFeaturedRouter);

// Invite codes
router.use("/invites", invitesRouter);

// Auth: magic link, passkeys, social login
router.use("/auth/magic-link", magicLinkRouter);
router.use("/auth/passkey", passkeyRouter);
router.use("/auth/oauth", oauthRouter);

// Privacy preferences
router.use("/users/me/privacy", privacyRouter);

// Plagiarism / originality (author-only)
router.use(originalityRouter);

// Writing challenges / prompts
router.use("/challenges", challengesRouter);

// Post boost requests
router.use("/boost", boostRouter);

// Creator economy: service listings, commissions, skill endorsements, availability
router.use("/services", serviceListingsRouter);
router.use(endorsementsRouter);

// Creator opportunity board (public, auth optional)
router.use(opportunitiesRouter);

// QuillHive Library (public knowledge archive)
router.use("/library", libraryRouter);

// Notification preferences
router.use("/notifications", notificationPrefsRouter);

// Payments (Flutterwave gateway)
router.use("/payments", paymentRouter);

// Official QuillHive System Posting Engine
router.use("/admin", officialPostsRouter);
router.use(officialPublicRouter);

// Collaborative chains (E1–E6)
router.use(chainsRouter);

// Carousel generator (Unsplash + Pexels)
router.use(carouselRouter);

export default router;
