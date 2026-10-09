# QuillHive project overview

> Generated on 2026-10-09 from the checked-out source. Re-run `pnpm project:snapshot` to refresh both this file's route/database inventories and `database/schema_sync.sql`. Feature-state and gap assessments below are source audits and should be reviewed when implementation changes.

## Project shape

QuillHive is a pnpm TypeScript monorepo. The deployed API is an Express service in `apps/api`; the signed-in/public SPA is in `apps/web`; `apps/public-web` is a separate public-facing web application. Shared database types and Drizzle schema are in `packages/utils/db`; API client/spec packages live under `packages/utils`. PostgreSQL is the source of persisted application state, with optional Redis/cache and external media, email, AI, and payment integrations.

## Feature implementation status

Status describes code wiring visible in this checkout, not the health of any deployed environment. “Fully working” means there is a connected implementation path in both UI and API; external credentials/services still determine runtime behavior.

| Feature area | What it does | Current state |
|---|---|---|
| Authentication and account recovery | Password registration/login, JWT/session refresh, email verification, password reset, magic links, OAuth, passkeys, 2FA, session listing/revocation. | **Fully working** in source; mail/OAuth/WebAuthn provider configuration is deployment-dependent and runtime was not tested. |
| Profiles and privacy | Public profiles, profile editing, privacy controls, profile views, portfolio/gallery, creator mode, language preferences. | **Fully working** in source across UI/API/schema; runtime was not tested. |
| Posts, feed, comments and engagement | Create/edit/publish/schedule posts, feed discovery, comments/replies, likes, saves, reposts, quote posts, shares, highlights and reading. | **Fully working** in source across UI/API/schema; recommendation/analytics quality depends on collected activity. |
| Short-form “sparks” | Compose and browse short updates/stories. | **Fully working** in source for the implemented short-form flows; runtime was not tested. |
| Groups | Create/discover/join groups, membership moderation, group posts, polls, questions, announcements, invitations and admin controls. | **Partially wired**: API/UI exist, but group creation explicitly returns a schema-update-unavailable response when required DB columns are missing. |
| Workspace and collaboration | Collaboration requests, collaboration rooms, portfolio/job workspace panels and project/payment proposals. | **Partially wired**; requests/rooms and panels exist, but the broader workspace is spread across separate opportunities, messaging, and creator-economy flows rather than one end-to-end project lifecycle. |
| Jobs and opportunities | Job/opportunity listings, applications, creator matching, click tracking, service listings and endorsements. | **Fully working** in source across UI/API/schema; payment/commission settlement remains provider/configuration dependent. |
| Messaging | Conversations, direct messages, read/seen state, payment proposals and realtime delivery. | **Fully working** in source; realtime delivery depends on the Socket.IO deployment and client connection. |
| Trust, safety and moderation | Trust/reputation scores and events, originality checks, reports, mutes/blocks, strikes, spam review and moderation rules. | **Partially wired**; multiple scoring/review mechanisms exist, but they are soft signals and moderator tools rather than a single automated enforcement pipeline. |
| Admin | User/content moderation, role/ban controls, reports, settings, feature flags, logs, trust/reputation, referrals, support and infrastructure monitoring. | **Fully working** for implemented admin pages/API; integrations and background metrics depend on deployment. |
| Post boost and payments | Boost requests/plans, Stripe/Flutterwave payment initiation/webhooks, admin approval/revoke and creator payment features. | **Partially wired**; payment paths are implemented, but live operation requires valid provider credentials, webhook setup, and end-to-end reconciliation. |
| Notifications | In-app notifications, preferences/digests, push subscriptions, unread/read actions and realtime updates. | **Fully working** in source; push/email delivery requires VAPID and mail service configuration. |
| Topics and discovery | Topic feeds/follows, search/discovery, recommendations, creator affinity and writing streaks. | **Partially wired**; feeds and UI exist, while personalization depends on activity data and scheduled/derived signals. |
| Series, collections, library and chains | Ordered post series, saved collections, curated knowledge library, and collaborative writing chains. | **Fully working** in source across implemented UI/API/schema; chain invitations/analytics are narrower than a full collaborative editor. |
| Polls and challenges | Post polls and writing challenges/submissions. | **Fully working** in source; poll creation is also subject to the configured feature gate. |
| Uploads, embeds and distribution | Upload/media metadata, public embeds/API, RSS, sitemap, ActivityPub routes and outbound webhooks. | **Partially wired**; media storage/CDN and public API/webhook integrations require deployment configuration; RSS/sitemap/ActivityPub are **backend-only-no-frontend**. Federation routes are not a complete federation network. |
| Achievements, streaks and reading tools | Achievement badges, writing/reading streaks, reading progress and post highlights. | **Fully working** in source with UI/API/schema paths; runtime and scheduled aggregation were not tested. |
| Mentions, invites and official content | Mention parsing/lookup, invite codes, system-authored official posts and featured content. | **Fully working** for the implemented API/UI paths; external distribution/runtime was not tested. |
| AI writing tools and carousel | Captions, edits, ideas, translation, title/tag suggestions and image carousel generation. | **Partially wired**; API/UI routes exist, with AI/image providers and credentials required at runtime. |
| Creator economy and income | Paid subscriptions, tips, creator earnings, paid-post access, services, commissions and availability. | **Partially wired**; records and payment flows exist, but provider-backed settlement and operational reconciliation require live configuration. |
| Support and email | Public/support ticket workflows, support messages, email endpoints and mail delivery. | **Partially wired**; support routes intentionally return unavailable when no support owner is configured; email depends on mail configuration. |
| Deployment and health | Health probes for database/cache/email/AI/CDN/payments, SPA serving, error capture and deployment configs. | **Partially wired**; probes and handlers are present, but health depends on external services and environment configuration. |

## Known gaps and incomplete work

- Group creation is deliberately unavailable when the required group-schema columns are absent; see [groups route](apps/api/src/routes/groups.ts) and [validation test](apps/api/src/__tests__/groups.validation.test.ts). Run the additive schema sync and verify the live DB before enabling it.
- Public/support ticket endpoints return an unavailable response if a support owner is not configured; see [public support routes](apps/api/src/features/support/public.routes.ts) and [support routes](apps/api/src/features/support/support.routes.ts).
- Push, email, OAuth/passkey, AI, image/media, payment and realtime functions are integration-dependent. Source presence does not imply credentials, provider webhooks, DNS, or production services are configured.
- Existing project audit files ([COMPREHENSIVE_AUDIT_REPORT.md](COMPREHENSIVE_AUDIT_REPORT.md), [AUDIT_QUICK_REFERENCE.md](AUDIT_QUICK_REFERENCE.md), and [CODE_QUALITY_AUDIT.md](CODE_QUALITY_AUDIT.md)) contain older dated findings and claims that were not independently revalidated as current. Treat them as historical, not authoritative project state.
- No feature was identified as wholly broken or frontend-only-no-backend in this static wiring pass; features with clear incomplete paths are marked partially wired.
- No active TODO/FIXME/XXX/HACK markers were found in the API, web, or Drizzle schema source during this pass. Runtime production behavior, deployment secrets, live database drift, external provider status, and scheduled-job execution were not probed by this source audit.
- The checked-in migration/export SQL has historically lagged the TypeScript schema; [database/schema_sync.sql](database/schema_sync.sql) is generated fresh from Drizzle schema and is additive. For populated tables, required no-default columns are added nullable, foreign keys are added NOT VALID to avoid scanning historical rows, and conflicting unique indexes are visibly skipped to avoid data loss or aborting the sync.

## API route inventory

The API application mounts the main router at `/api`; public distribution endpoints mounted directly by the Express app have no `/api` prefix. Paths below are effective paths where the router mount is statically declared. **UNMOUNTED** marks route declarations not mounted by the inspected Express app/router composition. Purposes are concise summaries inferred from the route action/path; see source links for exact behavior and middleware.

### app

- `GET /api/features` — Read or list features. ([source](apps/api/src/app.ts)).
- `GET /library/:slug` — Read or list library. ([source](apps/api/src/app.ts)).
- `GET /post/:id` — Read or list post. ([source](apps/api/src/app.ts)).
- `GET /profile/:username` — Read or list profile. ([source](apps/api/src/app.ts)).
- `GET /u/:username` — Read or list u. ([source](apps/api/src/app.ts)).

### features / achievements / achievement

- `GET /api/achievements` — Read or list achievements. ([source](apps/api/src/features/achievements/achievement.routes.ts)).
- `GET /api/achievements/user/:username` — Read or list achievements user. ([source](apps/api/src/features/achievements/achievement.routes.ts)).

### features / admin / extensions

- `GET /api/admin/featured-slots` — Read or list admin featured slots. ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `POST /api/admin/featured-slots` — Create or submit admin featured slots. ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `DELETE /api/admin/featured-slots/:id` — Remove admin featured slots. ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `GET /api/admin/groups` — Read or list admin groups. ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `PATCH /api/admin/groups/:id/promote` — Update groups promote. ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `PATCH /api/admin/groups/:id/unpromote` — Remove a group promotion (admin groups :id). ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `PATCH /api/admin/groups/:id/verify` — Verify the requested resource or transaction (admin groups :id). ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `GET /api/admin/jobs` — Read or list admin jobs. ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `PATCH /api/admin/jobs/:id/approve` — Approve a request (admin jobs :id). ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `PATCH /api/admin/jobs/:id/feature` — Update jobs feature. ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `PATCH /api/admin/jobs/:id/reject` — Reject a request (admin jobs :id). ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `PATCH /api/admin/posts/:id/sponsor` — Update posts sponsor. ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `PATCH /api/admin/posts/:id/unsponsor` — Remove a post sponsorship (admin posts :id). ([source](apps/api/src/features/admin/extensions.routes.ts)).
- `GET /api/featured` — Read or list featured. ([source](apps/api/src/features/admin/extensions.routes.ts)).

### features / admin / master

- `GET /api/admin/master/conversations` — Read or list master conversations. ([source](apps/api/src/features/admin/master.routes.ts)).
- `GET /api/admin/master/groups` — Read or list master groups. ([source](apps/api/src/features/admin/master.routes.ts)).
- `GET /api/admin/master/groups/:id` — Read or list master groups. ([source](apps/api/src/features/admin/master.routes.ts)).
- `GET /api/admin/master/overview` — Read or list master overview. ([source](apps/api/src/features/admin/master.routes.ts)).
- `GET /api/admin/master/users` — Read or list master users. ([source](apps/api/src/features/admin/master.routes.ts)).
- `GET /api/admin/master/users/:id` — Read or list master users. ([source](apps/api/src/features/admin/master.routes.ts)).

### features / admin / monitoring

- `POST /api/admin/monitoring/clear` — Create or submit monitoring clear. ([source](apps/api/src/features/admin/monitoring.routes.ts)).
- `POST /api/admin/monitoring/digest/send` — Send a message or notification (admin monitoring digest). ([source](apps/api/src/features/admin/monitoring.routes.ts)).
- `GET /api/admin/monitoring/events` — Read or list monitoring events. ([source](apps/api/src/features/admin/monitoring.routes.ts)).
- `GET /api/admin/monitoring/health` — Read or list monitoring health. ([source](apps/api/src/features/admin/monitoring.routes.ts)).
- `GET /api/admin/monitoring/metrics` — Read or list monitoring metrics. ([source](apps/api/src/features/admin/monitoring.routes.ts)).
- `POST /api/admin/monitoring/test-email` — Create or submit monitoring test email. ([source](apps/api/src/features/admin/monitoring.routes.ts)).

### features / admin / spamReview

- `GET /api/admin/spam-review` — Read or list admin spam review. ([source](apps/api/src/features/admin/spamReview.routes.ts)).
- `POST /api/admin/spam-review/:id/decision` — Create or submit spam review decision. ([source](apps/api/src/features/admin/spamReview.routes.ts)).

### features / analytics / analytics

- `GET /api/analytics/content-intelligence` — Read or list analytics content intelligence. ([source](apps/api/src/features/analytics/analytics.routes.ts)).
- `GET /api/analytics/creator/:username/stats` — Read or list creator stats. ([source](apps/api/src/features/analytics/analytics.routes.ts)).
- `GET /api/analytics/creator/spending` — Read or list creator spending. ([source](apps/api/src/features/analytics/analytics.routes.ts)).
- `GET /api/analytics/dashboard` — Read or list analytics dashboard. ([source](apps/api/src/features/analytics/analytics.routes.ts)).
- `GET /api/analytics/geography` — Read or list analytics geography. ([source](apps/api/src/features/analytics/analytics.routes.ts)).
- `GET /api/analytics/growth-score` — Read or list analytics growth score. ([source](apps/api/src/features/analytics/analytics.routes.ts)).
- `GET /api/analytics/opportunity-readiness` — Read or list analytics opportunity readiness. ([source](apps/api/src/features/analytics/analytics.routes.ts)).
- `GET /api/analytics/portfolio-views` — Read or list analytics portfolio views. ([source](apps/api/src/features/analytics/analytics.routes.ts)).
- `GET /api/analytics/post/:id` — Read or list analytics post. ([source](apps/api/src/features/analytics/analytics.routes.ts)).
- `GET /api/analytics/read-depth` — Read or list analytics read depth. ([source](apps/api/src/features/analytics/analytics.routes.ts)).
- `GET /api/analytics/topics` — Read or list analytics topics. ([source](apps/api/src/features/analytics/analytics.routes.ts)).
- `GET /api/analytics/user` — Read or list analytics user. ([source](apps/api/src/features/analytics/analytics.routes.ts)).
- `GET /api/analytics/weekly-report` — Read or list analytics weekly report. ([source](apps/api/src/features/analytics/analytics.routes.ts)).

### features / auth / magicLink

- `POST /api/auth/magic-link/consume` — Consume a one-time token (auth magic-link). ([source](apps/api/src/features/auth/magicLink.routes.ts)).
- `POST /api/auth/magic-link/request` — Submit a request (auth magic-link). ([source](apps/api/src/features/auth/magicLink.routes.ts)).

### features / auth / oauth

- `GET /api/auth/oauth/:provider/callback` — Read or list oauth callback. ([source](apps/api/src/features/auth/oauth.routes.ts)).
- `POST /api/auth/oauth/:provider/callback` — Create or submit oauth callback. ([source](apps/api/src/features/auth/oauth.routes.ts)).
- `GET /api/auth/oauth/:provider/start` — Start the requested operation (auth oauth :provider). ([source](apps/api/src/features/auth/oauth.routes.ts)).

### features / auth / passkey

- `GET /api/auth/passkey` — Read or list auth passkey. ([source](apps/api/src/features/auth/passkey.routes.ts)).
- `DELETE /api/auth/passkey/:id` — Remove auth passkey. ([source](apps/api/src/features/auth/passkey.routes.ts)).
- `POST /api/auth/passkey/authenticate` — Authenticate a user (auth passkey). ([source](apps/api/src/features/auth/passkey.routes.ts)).
- `GET /api/auth/passkey/authentication-options` — Read or list passkey authentication options. ([source](apps/api/src/features/auth/passkey.routes.ts)).
- `POST /api/auth/passkey/register` — Register a user (auth passkey). ([source](apps/api/src/features/auth/passkey.routes.ts)).
- `GET /api/auth/passkey/registration-options` — Read or list passkey registration options. ([source](apps/api/src/features/auth/passkey.routes.ts)).

### features / boost / boost

- `POST /api/boost/:id/approve` — Approve a request (boost :id). ([source](apps/api/src/features/boost/boost.routes.ts)).
- `POST /api/boost/:id/reject` — Reject a request (boost :id). ([source](apps/api/src/features/boost/boost.routes.ts)).
- `POST /api/boost/:id/revoke` — Revoke the requested access or promotion (boost :id). ([source](apps/api/src/features/boost/boost.routes.ts)).
- `GET /api/boost/admin` — Read or list boost admin. ([source](apps/api/src/features/boost/boost.routes.ts)).
- `POST /api/boost/init-payment` — Create or submit boost init payment. ([source](apps/api/src/features/boost/boost.routes.ts)).
- `GET /api/boost/my` — Read or list boost my. ([source](apps/api/src/features/boost/boost.routes.ts)).
- `GET /api/boost/payment-methods` — Read or list boost payment methods. ([source](apps/api/src/features/boost/boost.routes.ts)).
- `GET /api/boost/plans` — Read or list boost plans. ([source](apps/api/src/features/boost/boost.routes.ts)).
- `POST /api/boost/request` — Submit a request (boost). ([source](apps/api/src/features/boost/boost.routes.ts)).
- `POST /api/boost/stripe/init-payment` — Create or submit stripe init payment. ([source](apps/api/src/features/boost/boost.routes.ts)).
- `GET /api/boost/stripe/session/:sessionId` — Read or list stripe session. ([source](apps/api/src/features/boost/boost.routes.ts)).
- `POST /api/boost/stripe/webhook` — Create or submit stripe webhook. ([source](apps/api/src/features/boost/boost.routes.ts)).
- `GET /api/boost/verify-payment` — Read or list boost verify payment. ([source](apps/api/src/features/boost/boost.routes.ts)).
- `POST /api/boost/webhook` — Create or submit boost webhook. ([source](apps/api/src/features/boost/boost.routes.ts)).

### features / carousel / carousel

- `POST /api/carousel/generate` — Create or submit carousel generate. ([source](apps/api/src/features/carousel/carousel.routes.ts)).
- `GET /api/carousel/topics` — Read or list carousel topics. ([source](apps/api/src/features/carousel/carousel.routes.ts)).

### features / chains / chains

- `GET /api/chains` — Read or list chains. ([source](apps/api/src/features/chains/chains.routes.ts)).
- `POST /api/chains` — Create or submit chains. ([source](apps/api/src/features/chains/chains.routes.ts)).
- `DELETE /api/chains/:id` — Remove chains. ([source](apps/api/src/features/chains/chains.routes.ts)).
- `GET /api/chains/:id` — Read or list chains. ([source](apps/api/src/features/chains/chains.routes.ts)).
- `GET /api/chains/:id/analytics` — Read or list chains analytics. ([source](apps/api/src/features/chains/chains.routes.ts)).
- `POST /api/chains/:id/entries` — Create or submit chains entries. ([source](apps/api/src/features/chains/chains.routes.ts)).
- `POST /api/chains/:id/invites` — Create or submit chains invites. ([source](apps/api/src/features/chains/chains.routes.ts)).
- `GET /api/chains/mine` — Read or list chains mine. ([source](apps/api/src/features/chains/chains.routes.ts)).

### features / challenges / challenges

- `GET /api/challenges` — Read or list challenges. ([source](apps/api/src/features/challenges/challenges.routes.ts)).
- `POST /api/challenges` — Create or submit challenges. ([source](apps/api/src/features/challenges/challenges.routes.ts)).
- `GET /api/challenges/:id` — Read or list challenges. ([source](apps/api/src/features/challenges/challenges.routes.ts)).
- `PATCH /api/challenges/:id/deactivate` — Update challenges deactivate. ([source](apps/api/src/features/challenges/challenges.routes.ts)).
- `PATCH /api/challenges/:id/feature` — Update challenges feature. ([source](apps/api/src/features/challenges/challenges.routes.ts)).
- `POST /api/challenges/:id/submit` — Create or submit challenges submit. ([source](apps/api/src/features/challenges/challenges.routes.ts)).

### features / collaboration / collaboration

- `POST /api/collaboration/request` — Submit a request (collaboration). ([source](apps/api/src/features/collaboration/collaboration.routes.ts)).
- `PATCH /api/collaboration/requests/:requestId` — Update collaboration requests. ([source](apps/api/src/features/collaboration/collaboration.routes.ts)).
- `GET /api/collaboration/requests/received` — Read or list requests received. ([source](apps/api/src/features/collaboration/collaboration.routes.ts)).
- `GET /api/collaboration/requests/sent` — Read or list requests sent. ([source](apps/api/src/features/collaboration/collaboration.routes.ts)).
- `GET /api/collaboration/rooms` — Read or list collaboration rooms. ([source](apps/api/src/features/collaboration/collaboration.routes.ts)).
- `POST /api/collaboration/rooms` — Create or submit collaboration rooms. ([source](apps/api/src/features/collaboration/collaboration.routes.ts)).
- `PATCH /api/collaboration/rooms/:roomId` — Update collaboration rooms. ([source](apps/api/src/features/collaboration/collaboration.routes.ts)).

### features / collections / collections

- `GET /api/collections` — Read or list collections. ([source](apps/api/src/features/collections/collections.routes.ts)).
- `POST /api/collections` — Create or submit collections. ([source](apps/api/src/features/collections/collections.routes.ts)).
- `DELETE /api/collections/:id` — Remove collections. ([source](apps/api/src/features/collections/collections.routes.ts)).
- `GET /api/collections/:id` — Read or list collections. ([source](apps/api/src/features/collections/collections.routes.ts)).
- `PATCH /api/collections/:id` — Update collections. ([source](apps/api/src/features/collections/collections.routes.ts)).
- `DELETE /api/collections/:id/posts/:postId` — Remove collections posts. ([source](apps/api/src/features/collections/collections.routes.ts)).
- `POST /api/collections/:id/posts/:postId` — Create or submit collections posts. ([source](apps/api/src/features/collections/collections.routes.ts)).
- `GET /api/collections/public/:id` — Read or list collections public. ([source](apps/api/src/features/collections/collections.routes.ts)).

### features / creator-economy / opportunities

- `GET /api/opportunities` — Read or list opportunities. ([source](apps/api/src/features/creator-economy/opportunities.routes.ts)).

### features / creator-economy / serviceListing

- `GET /api/services` — Read or list services. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `POST /api/services` — Create or submit services. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `DELETE /api/services/:id` — Remove services. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `GET /api/services/:id` — Read or list services. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `PATCH /api/services/:id` — Update services. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `POST /api/services/:id/commission` — Create or submit services commission. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `PATCH /api/services/commissions/:id/respond` — Update commissions respond. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `GET /api/services/commissions/received` — Read or list commissions received. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `GET /api/services/commissions/sent` — Read or list commissions sent. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `GET /api/services/creator/:username` — Read or list services creator. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `GET /api/services/me` — Read or list services me. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `GET /api/users/:username/availability` — Read or list users availability. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `DELETE /api/users/:username/endorse` — Remove users endorse. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `POST /api/users/:username/endorse` — Create or submit users endorse. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `GET /api/users/:username/endorsements` — Read or list users endorsements. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).
- `PUT /api/users/me/availability` — Update me availability. ([source](apps/api/src/features/creator-economy/serviceListing.routes.ts)).

### features / discovery / discovery

- `GET /api/featured-posts` — Read or list featured posts. ([source](apps/api/src/features/discovery/discovery.routes.ts)).
- `GET /api/new-voices` — Read or list new voices. ([source](apps/api/src/features/discovery/discovery.routes.ts)).
- `GET /api/posts/:id/similar` — Read or list posts similar. ([source](apps/api/src/features/discovery/discovery.routes.ts)).
- `GET /api/recommendations/authors` — Read or list recommendations authors. ([source](apps/api/src/features/discovery/discovery.routes.ts)).
- `GET /api/search` — Search the requested resources. ([source](apps/api/src/features/discovery/discovery.routes.ts)).
- `GET /api/streaks/me` — Read or list streaks me. ([source](apps/api/src/features/discovery/discovery.routes.ts)).
- `POST /api/streaks/record` — Create or submit streaks record. ([source](apps/api/src/features/discovery/discovery.routes.ts)).
- `GET /api/suggested-creators` — Read or list suggested creators. ([source](apps/api/src/features/discovery/discovery.routes.ts)).
- `GET /api/trending-topics` — Read or list trending topics. ([source](apps/api/src/features/discovery/discovery.routes.ts)).

### features / discovery / writingStreaks

- `GET /api/writing-streaks/me` — Read or list writing streaks me. ([source](apps/api/src/features/discovery/writingStreaks.routes.ts)).
- `GET /api/writing-streaks/user/:username` — Read or list writing streaks user. ([source](apps/api/src/features/discovery/writingStreaks.routes.ts)).

### features / distribution / activitypub

- `GET /.well-known/webfinger` — Read or list .well known webfinger. ([source](apps/api/src/features/distribution/activitypub.routes.ts)).
- `GET /activitypub/users/:username` — Read or list activitypub users. ([source](apps/api/src/features/distribution/activitypub.routes.ts)).

### features / distribution / publicApi

- `GET /api/me/api-keys` — Read or list me api keys. ([source](apps/api/src/features/distribution/publicApi.routes.ts)).
- `POST /api/me/api-keys` — Create or submit me api keys. ([source](apps/api/src/features/distribution/publicApi.routes.ts)).
- `DELETE /api/me/api-keys/:id` — Remove me api keys. ([source](apps/api/src/features/distribution/publicApi.routes.ts)).
- `GET /api/v1/public/posts` — Read or list public posts. ([source](apps/api/src/features/distribution/publicApi.routes.ts)).
- `GET /api/v1/public/posts/:id` — Read or list public posts. ([source](apps/api/src/features/distribution/publicApi.routes.ts)).
- `GET /api/v1/public/users/:username` — Read or list public users. ([source](apps/api/src/features/distribution/publicApi.routes.ts)).

### features / distribution / rss

- `GET /rss/posts` — Read or list rss posts. ([source](apps/api/src/features/distribution/rss.routes.ts)).
- `GET /rss/users/:username` — Read or list rss users. ([source](apps/api/src/features/distribution/rss.routes.ts)).

### features / distribution / sitemap

- `GET /robots.txt` — Read or list robots.txt. ([source](apps/api/src/features/distribution/sitemap.routes.ts)).
- `GET /sitemap.xml` — Read or list sitemap.xml. ([source](apps/api/src/features/distribution/sitemap.routes.ts)).

### features / distribution / webhooks

- `GET /api/me/webhooks` — Read or list me webhooks. ([source](apps/api/src/features/distribution/webhooks.routes.ts)).
- `POST /api/me/webhooks` — Create or submit me webhooks. ([source](apps/api/src/features/distribution/webhooks.routes.ts)).
- `DELETE /api/me/webhooks/:id` — Remove me webhooks. ([source](apps/api/src/features/distribution/webhooks.routes.ts)).
- `PATCH /api/me/webhooks/:id` — Update me webhooks. ([source](apps/api/src/features/distribution/webhooks.routes.ts)).
- `GET /api/me/webhooks/:id/deliveries` — Read or list webhooks deliveries. ([source](apps/api/src/features/distribution/webhooks.routes.ts)).

### features / email / email

- `GET /api/email/check` — Read or list email check. ([source](apps/api/src/features/email/email.routes.ts)).
- `GET /api/email/unsubscribe` — Read or list email unsubscribe. ([source](apps/api/src/features/email/email.routes.ts)).
- `POST /api/email/unsubscribe` — Create or submit email unsubscribe. ([source](apps/api/src/features/email/email.routes.ts)).

### features / embed / embed

- `GET /api/embed/:id` — Read or list embed. ([source](apps/api/src/features/embed/embed.routes.ts)).
- `GET /api/embed/:id/meta` — Read or list embed meta. ([source](apps/api/src/features/embed/embed.routes.ts)).
- `GET /api/embed/link-preview` — Read or list embed link preview. ([source](apps/api/src/features/embed/embed.routes.ts)).

### features / gallery / gallery

- `POST /api/gallery` — Create or submit gallery. ([source](apps/api/src/features/gallery/gallery.routes.ts)).
- `DELETE /api/gallery/:id` — Remove gallery. ([source](apps/api/src/features/gallery/gallery.routes.ts)).
- `PATCH /api/gallery/:id` — Update gallery. ([source](apps/api/src/features/gallery/gallery.routes.ts)).
- `GET /api/gallery/:userId` — Read or list gallery. ([source](apps/api/src/features/gallery/gallery.routes.ts)).

### features / groups / groupAdmin

- `DELETE /api/groups/:id` — Remove groups. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `GET /api/groups/:id/activity` — Read or list groups activity. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `POST /api/groups/:id/archive` — Create or submit groups archive. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `POST /api/groups/:id/bans` — Create or submit groups bans. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `DELETE /api/groups/:id/bans/:userId` — Remove groups bans. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `PATCH /api/groups/:id/features` — Update groups features. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `POST /api/groups/:id/invite` — Create or submit groups invite. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `POST /api/groups/:id/invites` — Create or submit groups invites. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `GET /api/groups/:id/join-requests` — Read or list groups join requests. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `PATCH /api/groups/:id/join-requests/:requestId` — Update groups join requests. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `POST /api/groups/:id/join-requests/:requestId/approve` — Approve a request (groups :id join-requests :requestId). ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `POST /api/groups/:id/join-requests/:requestId/deny` — Create or submit join requests deny. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `GET /api/groups/:id/members` — Read or list groups members. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `DELETE /api/groups/:id/members/:userId` — Remove groups members. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `PATCH /api/groups/:id/members/:userId` — Update groups members. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `PATCH /api/groups/:id/members/:userId/status` — Update members status. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `GET /api/groups/:id/my-role` — Read or list groups my role. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `GET /api/groups/:id/pending-posts` — Read or list groups pending posts. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `GET /api/groups/:id/pinned` — Read or list groups pinned. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `DELETE /api/groups/:id/posts/:postId` — Remove groups posts. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `PATCH /api/groups/:id/posts/:postId/approval` — Update posts approval. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `DELETE /api/groups/:id/posts/:postId/pin` — Remove posts pin. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `POST /api/groups/:id/posts/:postId/pin` — Create or submit posts pin. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `GET /api/groups/:id/reports` — Read or list groups reports. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `PATCH /api/groups/:id/reports/:reportId` — Update groups reports. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `PATCH /api/groups/:id/settings` — Update groups settings. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).
- `POST /api/groups/invites/:code/accept` — Create or submit invites accept. ([source](apps/api/src/features/groups/groupAdmin.routes.ts)).

### features / highlights / highlights

- `GET /api/highlights` — Read or list highlights. ([source](apps/api/src/features/highlights/highlights.routes.ts)).
- `DELETE /api/highlights/posts/:id/highlight` — Remove posts highlight. ([source](apps/api/src/features/highlights/highlights.routes.ts)).
- `POST /api/highlights/posts/:id/highlight` — Create or submit posts highlight. ([source](apps/api/src/features/highlights/highlights.routes.ts)).

### features / income / income

- `GET /api/income` — Read or list income. ([source](apps/api/src/features/income/income.routes.ts)).
- `POST /api/income` — Create or submit income. ([source](apps/api/src/features/income/income.routes.ts)).
- `DELETE /api/income/:id` — Remove income. ([source](apps/api/src/features/income/income.routes.ts)).
- `GET /api/income/summary` — Read or list income summary. ([source](apps/api/src/features/income/income.routes.ts)).

### features / invites / invites

- `POST /api/invites/generate` — Create or submit invites generate. ([source](apps/api/src/features/invites/invites.routes.ts)).
- `GET /api/invites/mine` — Read or list invites mine. ([source](apps/api/src/features/invites/invites.routes.ts)).
- `GET /api/invites/validate/:code` — Read or list invites validate. ([source](apps/api/src/features/invites/invites.routes.ts)).

### features / languages / languages

- `GET /api/languages` — Read or list languages. ([source](apps/api/src/features/languages/languages.routes.ts)).
- `PUT /api/user/language` — Update user language. ([source](apps/api/src/features/languages/languages.routes.ts)).

### features / library / library

- `GET /api/library` — Read or list library. ([source](apps/api/src/features/library/library.routes.ts)).
- `POST /api/library` — Create or submit library. ([source](apps/api/src/features/library/library.routes.ts)).
- `DELETE /api/library/:id` — Remove library. ([source](apps/api/src/features/library/library.routes.ts)).
- `PATCH /api/library/:id/admin` — Update library admin. ([source](apps/api/src/features/library/library.routes.ts)).
- `POST /api/library/:id/save` — Create or submit library save. ([source](apps/api/src/features/library/library.routes.ts)).
- `GET /api/library/:slug` — Read or list library. ([source](apps/api/src/features/library/library.routes.ts)).
- `GET /api/library/my/entries` — Read or list my entries. ([source](apps/api/src/features/library/library.routes.ts)).
- `GET /api/library/my/saved` — Read or list my saved. ([source](apps/api/src/features/library/library.routes.ts)).

### features / mentions / mentions

- `POST /api/mentions/parse` — Create or submit mentions parse. ([source](apps/api/src/features/mentions/mentions.routes.ts)).
- `GET /api/mentions/search` — Search the requested resources (mentions). ([source](apps/api/src/features/mentions/mentions.routes.ts)).

### features / messaging / messaging

- `GET /api/messages/conversations` — Read or list messages conversations. ([source](apps/api/src/features/messaging/messaging.routes.ts)).
- `GET /api/messages/conversations/:conversationId` — Read or list messages conversations. ([source](apps/api/src/features/messaging/messaging.routes.ts)).
- `GET /api/messages/conversations/:conversationId/payment-proposals` — Read or list conversations payment proposals. ([source](apps/api/src/features/messaging/messaging.routes.ts)).
- `POST /api/messages/conversations/:conversationId/payment-proposals` — Create or submit conversations payment proposals. ([source](apps/api/src/features/messaging/messaging.routes.ts)).
- `PATCH /api/messages/conversations/:conversationId/payment-proposals/:proposalId` — Update conversations payment proposals. ([source](apps/api/src/features/messaging/messaging.routes.ts)).
- `POST /api/messages/conversations/:conversationId/seen` — Mark conversation messages as seen (messages conversations :conversationId). ([source](apps/api/src/features/messaging/messaging.routes.ts)).
- `POST /api/messages/send` — Send a message or notification (messages). ([source](apps/api/src/features/messaging/messaging.routes.ts)).
- `POST /api/messages/start` — Start the requested operation (messages). ([source](apps/api/src/features/messaging/messaging.routes.ts)).
- `GET /api/messages/unread-count` — Return the unread count (messages). ([source](apps/api/src/features/messaging/messaging.routes.ts)).

### features / notifications / notificationPrefs

- `GET /api/notifications/preferences` — Read or list notifications preferences. ([source](apps/api/src/features/notifications/notificationPrefs.routes.ts)).
- `PATCH /api/notifications/preferences` — Update notifications preferences. ([source](apps/api/src/features/notifications/notificationPrefs.routes.ts)).
- `POST /api/notifications/preferences/reset` — Reset the requested settings (notifications preferences). ([source](apps/api/src/features/notifications/notificationPrefs.routes.ts)).

### features / notifications / push

- `DELETE /api/push/subscribe` — Remove push subscribe. ([source](apps/api/src/features/notifications/push.routes.ts)).
- `POST /api/push/subscribe` — Create or submit push subscribe. ([source](apps/api/src/features/notifications/push.routes.ts)).
- `GET /api/push/vapid-public-key` — Read or list push vapid public key. ([source](apps/api/src/features/notifications/push.routes.ts)).

### features / official / officialPosts

- `GET /api/admin/official-posts` — Read or list admin official posts. ([source](apps/api/src/features/official/officialPosts.routes.ts)).
- `POST /api/admin/official-posts` — Create or submit admin official posts. ([source](apps/api/src/features/official/officialPosts.routes.ts)).
- `DELETE /api/admin/official-posts/:id` — Remove admin official posts. ([source](apps/api/src/features/official/officialPosts.routes.ts)).
- `PATCH /api/admin/official-posts/:id` — Update admin official posts. ([source](apps/api/src/features/official/officialPosts.routes.ts)).
- `POST /api/admin/official-posts/:id/publish` — Publish scheduled content (admin official-posts :id). ([source](apps/api/src/features/official/officialPosts.routes.ts)).
- `GET /api/admin/official-posts/analytics` — Read or list official posts analytics. ([source](apps/api/src/features/official/officialPosts.routes.ts)).
- `GET /api/official/feed` — Read or list official feed. ([source](apps/api/src/features/official/officialPosts.routes.ts)).
- `POST /api/posts/:id/cta-click` — Create or submit posts cta click. ([source](apps/api/src/features/official/officialPosts.routes.ts)).

### features / payments / payment

- `POST /api/payments/initiate` — Create or submit payments initiate. ([source](apps/api/src/features/payments/payment.routes.ts)).
- `POST /api/payments/service/initiate` — Create or submit service initiate. ([source](apps/api/src/features/payments/payment.routes.ts)).
- `GET /api/payments/service/verify` — Verify the requested resource or transaction (payments service). ([source](apps/api/src/features/payments/payment.routes.ts)).
- `GET /api/payments/status` — Read or list payments status. ([source](apps/api/src/features/payments/payment.routes.ts)).
- `GET /api/payments/verify/:transactionId` — Read or list payments verify. ([source](apps/api/src/features/payments/payment.routes.ts)).
- `POST /api/payments/webhook` — Create or submit payments webhook. ([source](apps/api/src/features/payments/payment.routes.ts)).

### features / polls / polls

- `POST /api/polls` — Create or submit polls. ([source](apps/api/src/features/polls/polls.routes.ts)).
- `GET /api/polls/:id` — Read or list polls. ([source](apps/api/src/features/polls/polls.routes.ts)).
- `POST /api/polls/:id/vote` — Record a vote (polls :id). ([source](apps/api/src/features/polls/polls.routes.ts)).
- `GET /api/polls/:id/voters` — Read or list polls voters. ([source](apps/api/src/features/polls/polls.routes.ts)).
- `GET /api/polls/post/:postId` — Read or list polls post. ([source](apps/api/src/features/polls/polls.routes.ts)).
- `POST /api/polls/standalone` — Create or submit polls standalone. ([source](apps/api/src/features/polls/polls.routes.ts)).

### features / posts / post

- `DELETE /api/comments/:id/like` — Remove comments like. ([source](apps/api/src/features/posts/post.routes.ts)).
- `POST /api/comments/:id/like` — Create or submit comments like. ([source](apps/api/src/features/posts/post.routes.ts)).
- `GET /api/comments/:id/replies` — Read or list comments replies. ([source](apps/api/src/features/posts/post.routes.ts)).
- `POST /api/comments/:id/reply` — Create or submit comments reply. ([source](apps/api/src/features/posts/post.routes.ts)).
- `GET /api/feed` — Read or list feed. ([source](apps/api/src/features/posts/post.routes.ts)).
- `GET /api/feed/motion` — Read or list feed motion. ([source](apps/api/src/features/posts/post.routes.ts)).
- `GET /api/feed/trending` — Read or list feed trending. ([source](apps/api/src/features/posts/post.routes.ts)).
- `GET /api/posts` — Read or list posts. ([source](apps/api/src/features/posts/post.routes.ts)).
- `POST /api/posts` — Create or submit posts. ([source](apps/api/src/features/posts/post.routes.ts)).
- `DELETE /api/posts/:id` — Remove posts. ([source](apps/api/src/features/posts/post.routes.ts)).
- `GET /api/posts/:id` — Read or list posts. ([source](apps/api/src/features/posts/post.routes.ts)).
- `PATCH /api/posts/:id` — Update posts. ([source](apps/api/src/features/posts/post.routes.ts)).
- `POST /api/posts/:id/ab-click/:variant` — Create or submit posts ab click. ([source](apps/api/src/features/posts/post.routes.ts)).
- `GET /api/posts/:id/comments` — Read or list posts comments. ([source](apps/api/src/features/posts/post.routes.ts)).
- `POST /api/posts/:id/comments` — Create or submit posts comments. ([source](apps/api/src/features/posts/post.routes.ts)).
- `GET /api/posts/:id/curators` — Read or list posts curators. ([source](apps/api/src/features/posts/post.routes.ts)).
- `POST /api/posts/:id/like` — Create or submit posts like. ([source](apps/api/src/features/posts/post.routes.ts)).
- `POST /api/posts/:id/repost` — Create or submit posts repost. ([source](apps/api/src/features/posts/post.routes.ts)).
- `GET /api/posts/:id/reposts` — Read or list posts reposts. ([source](apps/api/src/features/posts/post.routes.ts)).
- `DELETE /api/posts/:id/save` — Remove posts save. ([source](apps/api/src/features/posts/post.routes.ts)).
- `POST /api/posts/:id/save` — Create or submit posts save. ([source](apps/api/src/features/posts/post.routes.ts)).
- `POST /api/posts/:id/share` — Create or submit posts share. ([source](apps/api/src/features/posts/post.routes.ts)).
- `POST /api/posts/:id/track-share` — Create or submit posts track share. ([source](apps/api/src/features/posts/post.routes.ts)).
- `POST /api/posts/draft` — Create or submit posts draft. ([source](apps/api/src/features/posts/post.routes.ts)).
- `DELETE /api/posts/draft/:id` — Remove posts draft. ([source](apps/api/src/features/posts/post.routes.ts)).
- `GET /api/posts/draft/:id` — Read or list posts draft. ([source](apps/api/src/features/posts/post.routes.ts)).
- `GET /api/posts/my-drafts` — Read or list posts my drafts. ([source](apps/api/src/features/posts/post.routes.ts)).
- `POST /api/sparks/:id/view` — Create or submit sparks view. ([source](apps/api/src/features/posts/post.routes.ts)).
- `GET /api/sparks/active` — Read or list sparks active. ([source](apps/api/src/features/posts/post.routes.ts)).

### features / posts / postVersions

- `GET /api/posts/:id/versions` — Read or list posts versions. ([source](apps/api/src/features/posts/postVersions.routes.ts)).
- `GET /api/posts/:id/versions/:versionId` — Read or list posts versions. ([source](apps/api/src/features/posts/postVersions.routes.ts)).

### features / profiles / privacy

- `GET /api/users/me/privacy` — Read or list me privacy. ([source](apps/api/src/features/profiles/privacy.routes.ts)).
- `PATCH /api/users/me/privacy` — Update me privacy. ([source](apps/api/src/features/profiles/privacy.routes.ts)).

### features / profiles / profile

- `POST /api/auth/change-password` — Create or submit auth change password. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/auth/forgot-password` — Create or submit auth forgot password. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/auth/login` — Authenticate a user (auth). ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/auth/login/verify-email-code` — Create or submit login verify email code. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/auth/logout` — End a user session (auth). ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `DELETE /api/auth/me` — Remove auth me. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/auth/me` — Read or list auth me. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/auth/me/export` — Read or list me export. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/auth/refresh` — Refresh authentication (auth). ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/auth/register` — Register a user (auth). ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/auth/resend-verification` — Create or submit auth resend verification. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/auth/reset-password` — Create or submit auth reset password. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/auth/signup` — Create an account (auth). ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/auth/verify-email` — Create or submit auth verify email. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users` — Read or list users. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/:username` — Read or list users. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/:username/creator` — Read or list users creator. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/users/:username/follow` — Create or submit users follow. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/:username/followers` — Read or list users followers. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/:username/following` — Read or list users following. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/:username/portfolio` — Read or list users portfolio. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/:username/posts` — Read or list users posts. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/featured` — Read or list users featured. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/hireable` — Read or list users hireable. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `PATCH /api/users/me` — Update users me. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `PATCH /api/users/me/creator` — Update me creator. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `PATCH /api/users/me/creator-mode` — Update me creator mode. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/me/education` — Read or list me education. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/users/me/education` — Create or submit me education. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `DELETE /api/users/me/education/:id` — Remove me education. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `PATCH /api/users/me/education/:id` — Update me education. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `PATCH /api/users/me/profile` — Update me profile. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/me/profile-strength` — Read or list me profile strength. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/me/profile-viewers` — Read or list me profile viewers. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/me/saved` — Read or list me saved. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `PATCH /api/users/me/settings` — Update me settings. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/users/me/verification` — Create or submit me verification. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/me/work-history` — Read or list me work history. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `POST /api/users/me/work-history` — Create or submit me work history. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `DELETE /api/users/me/work-history/:id` — Remove me work history. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `PATCH /api/users/me/work-history/:id` — Update me work history. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/recommended` — Read or list users recommended. ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/search` — Search the requested resources (users). ([source](apps/api/src/features/profiles/profile.routes.ts)).
- `GET /api/users/suggested` — Read or list users suggested. ([source](apps/api/src/features/profiles/profile.routes.ts)).

### features / reader / readingProgress

- `GET /api/reading-progress` — Read or list reading progress. ([source](apps/api/src/features/reader/readingProgress.routes.ts)).
- `GET /api/reading-progress/:postId` — Read or list reading progress. ([source](apps/api/src/features/reader/readingProgress.routes.ts)).
- `PUT /api/reading-progress/:postId` — Update reading progress. ([source](apps/api/src/features/reader/readingProgress.routes.ts)).

### features / safety / blocks

- `GET /api/blocks` — Read or list blocks. ([source](apps/api/src/features/safety/blocks.routes.ts)).
- `DELETE /api/blocks/:userId` — Remove blocks. ([source](apps/api/src/features/safety/blocks.routes.ts)).
- `POST /api/blocks/:userId` — Create or submit blocks. ([source](apps/api/src/features/safety/blocks.routes.ts)).
- `DELETE /api/blocks/mute/:userId` — Remove blocks mute. ([source](apps/api/src/features/safety/blocks.routes.ts)).
- `POST /api/blocks/mute/:userId` — Create or submit blocks mute. ([source](apps/api/src/features/safety/blocks.routes.ts)).

### features / safety / originality

- `GET /api/posts/:id/originality` — Read or list posts originality. ([source](apps/api/src/features/safety/originality.routes.ts)).

### features / safety / safety

- `POST /api/safety/check` — Create or submit safety check. ([source](apps/api/src/features/safety/safety.routes.ts)).

### features / series / series

- `GET /api/series` — Read or list series. ([source](apps/api/src/features/series/series.routes.ts)).
- `POST /api/series` — Create or submit series. ([source](apps/api/src/features/series/series.routes.ts)).
- `DELETE /api/series/:id` — Remove series. ([source](apps/api/src/features/series/series.routes.ts)).
- `GET /api/series/:id` — Read or list series. ([source](apps/api/src/features/series/series.routes.ts)).
- `PATCH /api/series/:id` — Update series. ([source](apps/api/src/features/series/series.routes.ts)).
- `DELETE /api/series/:id/posts/:postId` — Remove series posts. ([source](apps/api/src/features/series/series.routes.ts)).
- `POST /api/series/:id/posts/:postId` — Create or submit series posts. ([source](apps/api/src/features/series/series.routes.ts)).
- `GET /api/series/user/:username` — Read or list series user. ([source](apps/api/src/features/series/series.routes.ts)).

### features / series / seriesNav

- `GET /api/posts/:id/series-nav` — Read or list posts series nav. ([source](apps/api/src/features/series/seriesNav.routes.ts)).

### features / strikes / strikes

- `POST /api/strikes/:id/acknowledge` — Acknowledge a notice (strikes :id). ([source](apps/api/src/features/strikes/strikes.routes.ts)).
- `GET /api/strikes/me` — Read or list strikes me. ([source](apps/api/src/features/strikes/strikes.routes.ts)).
- `GET /api/strikes/me/unacknowledged` — Read or list me unacknowledged. ([source](apps/api/src/features/strikes/strikes.routes.ts)).

### features / support / public

- `POST /api/support/appeal` — Create or submit support appeal. ([source](apps/api/src/features/support/public.routes.ts)).
- `POST /api/support/contact` — Create or submit support contact. ([source](apps/api/src/features/support/public.routes.ts)).
- `POST /api/support/dmca` — Create or submit support dmca. ([source](apps/api/src/features/support/public.routes.ts)).

### features / support / support

- `GET /api/support/admin/tickets` — Read or list admin tickets. ([source](apps/api/src/features/support/support.routes.ts)).
- `PATCH /api/support/admin/tickets/:id` — Update admin tickets. ([source](apps/api/src/features/support/support.routes.ts)).
- `POST /api/support/admin/tickets/:id/message` — Create or submit tickets message. ([source](apps/api/src/features/support/support.routes.ts)).
- `GET /api/support/admin/tickets/:id/messages` — Read or list tickets messages. ([source](apps/api/src/features/support/support.routes.ts)).
- `POST /api/support/report` — Submit a report (support). ([source](apps/api/src/features/support/support.routes.ts)).
- `GET /api/support/safety` — Read or list support safety. ([source](apps/api/src/features/support/support.routes.ts)).
- `PUT /api/support/safety` — Update support safety. ([source](apps/api/src/features/support/support.routes.ts)).
- `GET /api/support/tickets` — Read or list support tickets. ([source](apps/api/src/features/support/support.routes.ts)).
- `POST /api/support/tickets` — Create or submit support tickets. ([source](apps/api/src/features/support/support.routes.ts)).
- `POST /api/support/tickets/:id/message` — Create or submit tickets message. ([source](apps/api/src/features/support/support.routes.ts)).
- `GET /api/support/tickets/:id/messages` — Read or list tickets messages. ([source](apps/api/src/features/support/support.routes.ts)).

### features / topics / topics

- `GET /api/feed/topic/:slug` — Read or list feed topic. ([source](apps/api/src/features/topics/topics.routes.ts)).
- `GET /api/topics` — Read or list topics. ([source](apps/api/src/features/topics/topics.routes.ts)).
- `DELETE /api/topics/:id/follow` — Remove topics follow. ([source](apps/api/src/features/topics/topics.routes.ts)).
- `POST /api/topics/:id/follow` — Create or submit topics follow. ([source](apps/api/src/features/topics/topics.routes.ts)).
- `GET /api/topics/:slug` — Read or list topics. ([source](apps/api/src/features/topics/topics.routes.ts)).
- `GET /api/topics/following` — Read or list topics following. ([source](apps/api/src/features/topics/topics.routes.ts)).
- `GET /api/topics/trending` — Read or list topics trending. ([source](apps/api/src/features/topics/topics.routes.ts)).

### features / trust / trust

- `GET /api/admin/trust/users` — Read or list trust users. ([source](apps/api/src/features/trust/trust.routes.ts)).
- `GET /api/trust/:userId` — Read or list trust. ([source](apps/api/src/features/trust/trust.routes.ts)).
- `GET /api/trust/me` — Read or list trust me. ([source](apps/api/src/features/trust/trust.routes.ts)).
- `POST /api/trust/recalculate` — Create or submit trust recalculate. ([source](apps/api/src/features/trust/trust.routes.ts)).
- `GET /api/trust/timeline` — Read or list trust timeline. ([source](apps/api/src/features/trust/trust.routes.ts)).
- `GET /api/trust/timeline/:userId` — Read or list trust timeline. ([source](apps/api/src/features/trust/trust.routes.ts)).

### features / twofa / twofa

- `POST /api/auth/2fa/disable` — Disable the requested feature (auth 2fa). ([source](apps/api/src/features/twofa/twofa.routes.ts)).
- `POST /api/auth/2fa/enable` — Enable the requested feature (auth 2fa). ([source](apps/api/src/features/twofa/twofa.routes.ts)).
- `POST /api/auth/2fa/setup` — Set up the requested feature (auth 2fa). ([source](apps/api/src/features/twofa/twofa.routes.ts)).
- `GET /api/auth/2fa/status` — Read or list 2fa status. ([source](apps/api/src/features/twofa/twofa.routes.ts)).
- `POST /api/auth/2fa/verify` — Verify the requested resource or transaction (auth 2fa). ([source](apps/api/src/features/twofa/twofa.routes.ts)).

### features / uploads / upload

- `POST /api/file` — Create or submit file. ([source](apps/api/src/features/uploads/upload.routes.ts)).
- `GET /api/file/:id` — Read or list file. ([source](apps/api/src/features/uploads/upload.routes.ts)).
- `POST /api/upload` — Create or submit upload. ([source](apps/api/src/features/uploads/upload.routes.ts)).
- `GET /api/upload/:id` — Read or list upload. ([source](apps/api/src/features/uploads/upload.routes.ts)).

### routes / admin

- `GET /api/admin/behavior-events` — Read or list admin behavior events. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/blocked-emails` — Read or list admin blocked emails. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/communications` — Create or submit admin communications. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/communications/broadcast` — Create or submit communications broadcast. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/communications/broadcast/:jobId` — Read or list communications broadcast. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/communications/direct` — Create or submit communications direct. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/country-stats` — Read or list admin country stats. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/health` — Read or list admin health. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/insights` — Read or list admin insights. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/logs` — Read or list admin logs. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/notes` — Create or submit admin notes. ([source](apps/api/src/routes/admin.ts)).
- `DELETE /api/admin/notes/:id` — Remove admin notes. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/notes/:targetType/:targetId` — Read or list admin notes. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/posts` — Read or list admin posts. ([source](apps/api/src/routes/admin.ts)).
- `DELETE /api/admin/posts/:id` — Remove admin posts. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/posts/:id` — Read or list admin posts. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/posts/:id/flag` — Create or submit posts flag. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/posts/:id/grant-boost` — Create or submit posts grant boost. ([source](apps/api/src/routes/admin.ts)).
- `PATCH /api/admin/posts/:id/unpublish` — Unpublish content (admin posts :id). ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/referrals` — Read or list admin referrals. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/reports` — Read or list admin reports. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/reports` — Create or submit admin reports. ([source](apps/api/src/routes/admin.ts)).
- `PATCH /api/admin/reports/:id/dismiss` — Dismiss a report (admin reports :id). ([source](apps/api/src/routes/admin.ts)).
- `PATCH /api/admin/reports/:id/resolve` — Resolve a report (admin reports :id). ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/reports/grouped` — Read or list reports grouped. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/reputation-events` — Read or list admin reputation events. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/rules` — Read or list admin rules. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/rules` — Create or submit admin rules. ([source](apps/api/src/routes/admin.ts)).
- `DELETE /api/admin/rules/:id` — Remove admin rules. ([source](apps/api/src/routes/admin.ts)).
- `PATCH /api/admin/rules/:id` — Update admin rules. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/scheduled-posts` — Read or list admin scheduled posts. ([source](apps/api/src/routes/admin.ts)).
- `PATCH /api/admin/scheduled-posts/:id/publish` — Publish scheduled content (admin scheduled-posts :id). ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/settings` — Read or list admin settings. ([source](apps/api/src/routes/admin.ts)).
- `PATCH /api/admin/settings` — Update admin settings. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/settings/features` — Read or list settings features. ([source](apps/api/src/routes/admin.ts)).
- `PATCH /api/admin/settings/features` — Update settings features. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/stats` — Read or list admin stats. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/support/status` — Read or list support status. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/suspicious-clusters` — Read or list admin suspicious clusters. ([source](apps/api/src/routes/admin.ts)).
- `DELETE /api/admin/translation-cache` — Remove admin translation cache. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/translation-cache` — Read or list admin translation cache. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/users` — Read or list admin users. ([source](apps/api/src/routes/admin.ts)).
- `DELETE /api/admin/users/:id` — Remove admin users. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/users/:id/ban` — Create or submit users ban. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/users/:id/detail` — Read or list users detail. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/users/:id/notice` — Create or submit users notice. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/users/:id/official` — Create or submit users official. ([source](apps/api/src/routes/admin.ts)).
- `PATCH /api/admin/users/:id/reach` — Update users reach. ([source](apps/api/src/routes/admin.ts)).
- `PATCH /api/admin/users/:id/role` — Update users role. ([source](apps/api/src/routes/admin.ts)).
- `GET /api/admin/users/:id/strikes` — Read or list users strikes. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/users/:id/strikes` — Create or submit users strikes. ([source](apps/api/src/routes/admin.ts)).
- `POST /api/admin/users/:id/warn` — Create or submit users warn. ([source](apps/api/src/routes/admin.ts)).

### routes / ai

- `POST /api/ai/assist` — Create or submit ai assist. ([source](apps/api/src/routes/ai.ts)).
- `POST /api/ai/caption` — Create or submit ai caption. ([source](apps/api/src/routes/ai.ts)).
- `POST /api/ai/hashtags` — Create or submit ai hashtags. ([source](apps/api/src/routes/ai.ts)).
- `POST /api/ai/ideas` — Create or submit ai ideas. ([source](apps/api/src/routes/ai.ts)).
- `POST /api/ai/improve` — Create or submit ai improve. ([source](apps/api/src/routes/ai.ts)).
- `POST /api/ai/titles` — Create or submit ai titles. ([source](apps/api/src/routes/ai.ts)).
- `POST /api/ai/translate` — Create or submit ai translate. ([source](apps/api/src/routes/ai.ts)).

### routes / appreciations

- `POST /api/posts/:id/appreciate` — Record an appreciation (posts :id). ([source](apps/api/src/routes/appreciations.ts)).
- `GET /api/posts/:id/appreciations` — Read or list posts appreciations. ([source](apps/api/src/routes/appreciations.ts)).

### routes / groups

- `GET /api/groups` — Read or list groups. ([source](apps/api/src/routes/groups.ts)).
- `POST /api/groups` — Create or submit groups. ([source](apps/api/src/routes/groups.ts)).
- `GET /api/groups/:id` — Read or list groups. ([source](apps/api/src/routes/groups.ts)).
- `POST /api/groups/:id/join` — Create or submit groups join. ([source](apps/api/src/routes/groups.ts)).
- `POST /api/groups/:id/opportunities/:opportunityId/reshare` — Create or submit opportunities reshare. ([source](apps/api/src/routes/groups.ts)).
- `GET /api/groups/:id/posts` — Read or list groups posts. ([source](apps/api/src/routes/groups.ts)).
- `POST /api/groups/:id/posts` — Create or submit groups posts. ([source](apps/api/src/routes/groups.ts)).
- `POST /api/groups/:id/posts/:postId/archive` — Create or submit posts archive. ([source](apps/api/src/routes/groups.ts)).
- `POST /api/groups/:id/posts/:postId/best-answer` — Create or submit posts best answer. ([source](apps/api/src/routes/groups.ts)).
- `PATCH /api/groups/:id/posts/:postId/comments` — Update posts comments. ([source](apps/api/src/routes/groups.ts)).
- `POST /api/groups/:id/posts/:postId/report` — Submit a report (groups :id posts :postId). ([source](apps/api/src/routes/groups.ts)).
- `POST /api/groups/:id/posts/:postId/vote` — Record a vote (groups :id posts :postId). ([source](apps/api/src/routes/groups.ts)).

### routes / health

- `GET /api/api/healthz` — Read or list healthz. ([source](apps/api/src/routes/health.ts)).
- `GET /api/health/ai` — Read or list health ai. ([source](apps/api/src/routes/health.ts)).
- `GET /api/health/cache` — Read or list health cache. ([source](apps/api/src/routes/health.ts)).
- `GET /api/health/cdn` — Read or list health cdn. ([source](apps/api/src/routes/health.ts)).
- `GET /api/health/db` — Read or list health db. ([source](apps/api/src/routes/health.ts)).
- `GET /api/health/email` — Read or list health email. ([source](apps/api/src/routes/health.ts)).
- `GET /api/health/payments` — Read or list health payments. ([source](apps/api/src/routes/health.ts)).
- `GET /api/healthz` — Read or list healthz. ([source](apps/api/src/routes/health.ts)).

### routes / index

- `GET /api/auth/login-activity` — Read or list auth login activity. ([source](apps/api/src/routes/index.ts)).
- `GET /api/auth/sessions` — Read or list auth sessions. ([source](apps/api/src/routes/index.ts)).
- `DELETE /api/auth/sessions/:id` — Remove auth sessions. ([source](apps/api/src/routes/index.ts)).
- `POST /api/auth/sessions/logout-all` — Create or submit sessions logout all. ([source](apps/api/src/routes/index.ts)).

### routes / jobs

- `GET /api/jobs` — Read or list jobs. ([source](apps/api/src/routes/jobs.ts)).
- `POST /api/jobs` — Create or submit jobs. ([source](apps/api/src/routes/jobs.ts)).
- `DELETE /api/jobs/:id` — Remove jobs. ([source](apps/api/src/routes/jobs.ts)).
- `GET /api/jobs/:id` — Read or list jobs. ([source](apps/api/src/routes/jobs.ts)).
- `PATCH /api/jobs/:id` — Update jobs. ([source](apps/api/src/routes/jobs.ts)).
- `POST /api/jobs/:id/apply` — Submit an application (jobs :id). ([source](apps/api/src/routes/jobs.ts)).
- `POST /api/jobs/:id/click` — Create or submit jobs click. ([source](apps/api/src/routes/jobs.ts)).
- `GET /api/jobs/:id/creator-matches` — Read or list jobs creator matches. ([source](apps/api/src/routes/jobs.ts)).
- `GET /api/jobs/applications` — Read or list jobs applications. ([source](apps/api/src/routes/jobs.ts)).
- `GET /api/jobs/creators` — Read or list jobs creators. ([source](apps/api/src/routes/jobs.ts)).
- `GET /api/jobs/my-matches` — Read or list jobs my matches. ([source](apps/api/src/routes/jobs.ts)).

### routes / notifications

- `GET /api/notifications` — Read or list notifications. ([source](apps/api/src/routes/notifications.ts)).
- `DELETE /api/notifications/:id` — Remove notifications. ([source](apps/api/src/routes/notifications.ts)).
- `PATCH /api/notifications/:id/read` — Mark content as read (notifications :id). ([source](apps/api/src/routes/notifications.ts)).
- `GET /api/notifications/count` — Return a count (notifications). ([source](apps/api/src/routes/notifications.ts)).
- `GET /api/notifications/digest` — Read or list notifications digest. ([source](apps/api/src/routes/notifications.ts)).
- `POST /api/notifications/read` — Mark content as read (notifications). ([source](apps/api/src/routes/notifications.ts)).
- `PATCH /api/notifications/read-all` — Update notifications read all. ([source](apps/api/src/routes/notifications.ts)).
- `POST /api/notifications/read-all` — Create or submit notifications read all. ([source](apps/api/src/routes/notifications.ts)).

## Database tables

Every PostgreSQL table exported from the current Drizzle schema index is listed below. Table purposes are summarized from the table names and feature schema; the linked source file is authoritative.

| Table | Purpose | TypeScript schema |
|---|---|---|
| `blocked_email_attempts` | Rejected signup email attempts and reputation signals. | [schema](packages/utils/db/src/schema/users.ts) |
| `education_history` | User-entered education history. | [schema](packages/utils/db/src/schema/users.ts) |
| `email_verification_tokens` | One-time email verification tokens. | [schema](packages/utils/db/src/schema/users.ts) |
| `follows` | Directed follow relationships between users. | [schema](packages/utils/db/src/schema/users.ts) |
| `login_events` | Authentication and login-integrity event history. | [schema](packages/utils/db/src/schema/users.ts) |
| `revoked_tokens` | Revoked authentication tokens retained until expiry. | [schema](packages/utils/db/src/schema/users.ts) |
| `sessions` | Authenticated user sessions and token hashes. | [schema](packages/utils/db/src/schema/users.ts) |
| `users` | User accounts, public profiles, preferences, and account state. | [schema](packages/utils/db/src/schema/users.ts) |
| `work_history` | User-entered employment history. | [schema](packages/utils/db/src/schema/users.ts) |
| `comment_likes` | User likes on comments. | [schema](packages/utils/db/src/schema/posts.ts) |
| `comments` | Comments and replies on posts. | [schema](packages/utils/db/src/schema/posts.ts) |
| `likes` | User likes on posts. | [schema](packages/utils/db/src/schema/posts.ts) |
| `post_shares` | Post share events and source/click counts. | [schema](packages/utils/db/src/schema/posts.ts) |
| `posts` | Long-form and short-form authored content and publication state. | [schema](packages/utils/db/src/schema/posts.ts) |
| `reposts` | User repost relationships. | [schema](packages/utils/db/src/schema/posts.ts) |
| `saved_posts` | Posts saved by users. | [schema](packages/utils/db/src/schema/posts.ts) |
| `conversation_participants` | Users participating in conversations and read state. | [schema](packages/utils/db/src/schema/messages.ts) |
| `conversations` | Direct-message conversation records. | [schema](packages/utils/db/src/schema/messages.ts) |
| `messages` | Messages exchanged in conversations. | [schema](packages/utils/db/src/schema/messages.ts) |
| `conversation_payment_proposals` | Payment proposals sent within conversations. | [schema](packages/utils/db/src/schema/messages.ts) |
| `group_activity_logs` | Auditable group moderation and membership activity. | [schema](packages/utils/db/src/schema/groups.ts) |
| `group_bans` | Users banned from specific groups. | [schema](packages/utils/db/src/schema/groups.ts) |
| `group_invites` | Group invitations and their expiration/state. | [schema](packages/utils/db/src/schema/groups.ts) |
| `group_join_requests` | Membership requests and screening responses. | [schema](packages/utils/db/src/schema/groups.ts) |
| `group_members` | Group membership, roles, and status. | [schema](packages/utils/db/src/schema/groups.ts) |
| `group_pinned_posts` | Posts pinned within groups. | [schema](packages/utils/db/src/schema/groups.ts) |
| `group_post_details` | Group-specific post type, moderation, and pinned state. | [schema](packages/utils/db/src/schema/groups.ts) |
| `groups` | Community group configuration and visibility. | [schema](packages/utils/db/src/schema/groups.ts) |
| `jobs` | Posted work opportunities. | [schema](packages/utils/db/src/schema/jobs.ts) |
| `opportunity_applications` | Applications submitted to opportunities. | [schema](packages/utils/db/src/schema/opportunityApplications.ts) |
| `notifications` | In-app notification records and read state. | [schema](packages/utils/db/src/schema/notifications.ts) |
| `appreciations` | Stores appreciations data for the associated feature. | [schema](packages/utils/db/src/schema/appreciations.ts) |
| `moderation_strikes` | Moderation strikes assigned to users. | [schema](packages/utils/db/src/schema/reports.ts) |
| `reports` | User-submitted moderation reports. | [schema](packages/utils/db/src/schema/reports.ts) |
| `admin_logs` | Administrative actions and audit records. | [schema](packages/utils/db/src/schema/adminLogs.ts) |
| `system_settings` | Runtime feature flags and system configuration. | [schema](packages/utils/db/src/schema/systemSettings.ts) |
| `portfolio_items` | Creator portfolio entries. | [schema](packages/utils/db/src/schema/portfolio.ts) |
| `creator_profiles` | Creator-specific profile and availability metadata. | [schema](packages/utils/db/src/schema/creatorProfiles.ts) |
| `collaboration_requests` | Collaboration invitations and decisions. | [schema](packages/utils/db/src/schema/collaborationRequests.ts) |
| `collaboration_rooms` | Workspaces for accepted collaborations. | [schema](packages/utils/db/src/schema/collaborationRooms.ts) |
| `push_subscriptions` | Browser push notification subscriptions. | [schema](packages/utils/db/src/schema/pushSubscriptions.ts) |
| `achievements` | Achievement definitions. | [schema](packages/utils/db/src/schema/achievements.ts) |
| `user_achievements` | Achievements earned by users. | [schema](packages/utils/db/src/schema/achievements.ts) |
| `writing_activity` | Daily post-writing activity used for streak calculations. | [schema](packages/utils/db/src/schema/writingStreaks.ts) |
| `writing_streaks` | Per-user writing streak totals and current streak. | [schema](packages/utils/db/src/schema/writingStreaks.ts) |
| `post_views` | Stores post views data for the associated feature. | [schema](packages/utils/db/src/schema/analytics.ts) |
| `uploaded_files` | Uploaded media metadata and storage references. | [schema](packages/utils/db/src/schema/files.ts) |
| `safety_preferences` | Per-user safety and content-control settings. | [schema](packages/utils/db/src/schema/support.ts) |
| `support_messages` | Messages attached to support tickets. | [schema](packages/utils/db/src/schema/support.ts) |
| `support_tickets` | Support requests and ticket state. | [schema](packages/utils/db/src/schema/support.ts) |
| `behavior_events` | Behavioral signals used by trust and abuse detection. | [schema](packages/utils/db/src/schema/trustEngine.ts) |
| `post_trust_scores` | Trust signals and scores per post. | [schema](packages/utils/db/src/schema/trustEngine.ts) |
| `reputation_events` | Reputation changes and their causes. | [schema](packages/utils/db/src/schema/trustEngine.ts) |
| `user_trust_scores` | Current trust score and component signals per user. | [schema](packages/utils/db/src/schema/trustEngine.ts) |
| `post_topics` | Topic associations for posts. | [schema](packages/utils/db/src/schema/topics.ts) |
| `topic_follows` | Users following topics. | [schema](packages/utils/db/src/schema/topics.ts) |
| `topics` | Discoverable topic definitions. | [schema](packages/utils/db/src/schema/topics.ts) |
| `mentions` | User mentions extracted from content. | [schema](packages/utils/db/src/schema/mentions.ts) |
| `translation_cache` | Cached machine translations. | [schema](packages/utils/db/src/schema/translationCache.ts) |
| `series` | Ordered collections of posts authored as a series. | [schema](packages/utils/db/src/schema/series.ts) |
| `collection_posts` | Post membership and ordering within collections. | [schema](packages/utils/db/src/schema/collections.ts) |
| `collections` | User-curated post collections. | [schema](packages/utils/db/src/schema/collections.ts) |
| `income_logs` | Creator income and payout ledger events. | [schema](packages/utils/db/src/schema/incomeLogs.ts) |
| `post_versions` | Historical post content revisions. | [schema](packages/utils/db/src/schema/postVersions.ts) |
| `reading_progress` | Per-user progress through posts. | [schema](packages/utils/db/src/schema/readingProgress.ts) |
| `poll_options` | Selectable options for polls. | [schema](packages/utils/db/src/schema/polls.ts) |
| `poll_votes` | User selections in polls. | [schema](packages/utils/db/src/schema/polls.ts) |
| `polls` | Polls attached to posts. | [schema](packages/utils/db/src/schema/polls.ts) |
| `post_fingerprints` | Content fingerprints used for originality/reuse checks. | [schema](packages/utils/db/src/schema/postFingerprints.ts) |
| `reading_activity` | Daily reading activity used for streak calculations. | [schema](packages/utils/db/src/schema/readingStreaks.ts) |
| `reading_streaks` | Per-user reading streak totals and current streak. | [schema](packages/utils/db/src/schema/readingStreaks.ts) |
| `moderation_rules` | Configurable content moderation rules. | [schema](packages/utils/db/src/schema/moderationRules.ts) |
| `admin_notes` | Private moderator notes attached to users or content. | [schema](packages/utils/db/src/schema/adminNotes.ts) |
| `api_keys` | User-managed credentials for the public API. | [schema](packages/utils/db/src/schema/apiKeys.ts) |
| `webhook_deliveries` | Outbound webhook delivery attempts and outcomes. | [schema](packages/utils/db/src/schema/webhooks.ts) |
| `webhooks` | User webhook endpoint configuration and signing secrets. | [schema](packages/utils/db/src/schema/webhooks.ts) |
| `invite_codes` | Referral/invitation codes and redemption state. | [schema](packages/utils/db/src/schema/inviteCodes.ts) |
| `featured_slots` | Scheduled public featured-content slots. | [schema](packages/utils/db/src/schema/featuredSlots.ts) |
| `login_email_challenges` | Stores login email challenges data for the associated feature. | [schema](packages/utils/db/src/schema/auth.ts) |
| `magic_link_tokens` | One-time passwordless login tokens. | [schema](packages/utils/db/src/schema/auth.ts) |
| `oauth_accounts` | External OAuth identities linked to user accounts. | [schema](packages/utils/db/src/schema/auth.ts) |
| `passkeys` | WebAuthn credentials registered to user accounts. | [schema](packages/utils/db/src/schema/auth.ts) |
| `challenge_submissions` | User submissions to writing challenges. | [schema](packages/utils/db/src/schema/challenges.ts) |
| `challenges` | Writing challenge definitions and schedules. | [schema](packages/utils/db/src/schema/challenges.ts) |
| `boost_requests` | Paid or moderated post promotion requests and payment state. | [schema](packages/utils/db/src/schema/boostRequests.ts) |
| `commission_requests` | Commission requests and fulfillment status. | [schema](packages/utils/db/src/schema/creatorEconomy.ts) |
| `creator_availability` | Creator availability and open-to-work status. | [schema](packages/utils/db/src/schema/creatorEconomy.ts) |
| `creator_earnings` | Creator earnings ledger. | [schema](packages/utils/db/src/schema/creatorEconomy.ts) |
| `creator_payment_transactions` | Creator payment transactions and provider references. | [schema](packages/utils/db/src/schema/creatorEconomy.ts) |
| `creator_subscription_plans` | Creator-defined subscription tiers. | [schema](packages/utils/db/src/schema/creatorEconomy.ts) |
| `creator_subscriptions` | Paid subscriber relationships to creators. | [schema](packages/utils/db/src/schema/creatorEconomy.ts) |
| `creator_tips` | Tips paid to creators. | [schema](packages/utils/db/src/schema/creatorEconomy.ts) |
| `paid_post_access` | Paid access grants for premium posts. | [schema](packages/utils/db/src/schema/creatorEconomy.ts) |
| `service_listings` | Creator services available for hire. | [schema](packages/utils/db/src/schema/creatorEconomy.ts) |
| `skill_endorsements` | Skill endorsements between users. | [schema](packages/utils/db/src/schema/creatorEconomy.ts) |
| `creator_similarity` | Computed similarity between creator accounts. | [schema](packages/utils/db/src/schema/userTasteProfiles.ts) |
| `user_creator_affinity` | Personalized user-to-creator recommendation scores. | [schema](packages/utils/db/src/schema/userTasteProfiles.ts) |
| `user_taste_profiles` | Aggregated user interests for content recommendations. | [schema](packages/utils/db/src/schema/userTasteProfiles.ts) |
| `user_topic_affinity` | Personalized user-to-topic recommendation scores. | [schema](packages/utils/db/src/schema/userTasteProfiles.ts) |
| `library_entries` | Public knowledge-library articles and metadata. | [schema](packages/utils/db/src/schema/library.ts) |
| `library_saves` | User bookmarks of library entries. | [schema](packages/utils/db/src/schema/library.ts) |
| `chain_entries` | Posts contributed to collaborative chains. | [schema](packages/utils/db/src/schema/chains.ts) |
| `chains` | Collaborative post-chain metadata and settings. | [schema](packages/utils/db/src/schema/chains.ts) |
| `profile_views` | Profile-view events and viewer attribution. | [schema](packages/utils/db/src/schema/profileViews.ts) |
| `muted_users` | Per-user muted-account relationships. | [schema](packages/utils/db/src/schema/mutedUsers.ts) |
| `spam_review_flags` | Spam-detection findings awaiting or recording review. | [schema](packages/utils/db/src/schema/spamReview.ts) |

## Refreshing this snapshot

Run `pnpm project:snapshot` from the repository root. The command exports PostgreSQL DDL directly from `packages/utils/db/src/schema/index.ts`, regenerates the safe additive `database/schema_sync.sql`, and refreshes the route and table inventories in this file. Review the feature-state and known-gap prose above when functionality changes; those assessments are intentionally human-reviewed rather than inferred from filenames.
