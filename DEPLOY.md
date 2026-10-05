# QuillHive Deployment Sequence

## First deploy ONLY (run once):

1. Provision PostgreSQL database (Railway / Render / Neon)
2. Set all environment variables (see `apps/api/.env.example`)
3. Run database migrations:
   ```
   pnpm --filter @workspace/db db:push
   ```
4. Start API server:
   ```
   pnpm --filter @workspace/api-server start
   ```
5. After first boot, set yourself as super_admin:
   ```sql
   UPDATE users SET role = 'super_admin' WHERE email = 'your@email.com';
   ```
6. Configure email DNS (SPF, DKIM, DMARC) on your domain

## Every subsequent deploy:

1. Run migrations (safe to run multiple times):
   ```
   pnpm --filter @workspace/db db:push
   ```
2. Restart API server

## Healthcheck

The API exposes `GET /api/healthz` which returns:
- `200 { status: "ok" }` when database is reachable
- `503 { status: "degraded" }` when the database is down

Railway and Render use this endpoint to determine instance health.

## Environment variables checklist

See `apps/api/.env.example` - all fields are documented there.

Required for production:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - long random string (32+ chars)
- `REFRESH_SECRET` - different long random string
- `APP_URL` - your production frontend URL (e.g. `https://app.quillhive.com`)
- `SESSION_SECRET` - session signing secret

To seed or maintain the `careerevive` super-admin account, set `CAREEREVIVE_ADMIN_PASSWORD` to a unique secret of at least 16 characters. Without it, the seed does not create or promote the account and disables password login for any existing seeded account.

Recommended for production:
- `RESEND_API_KEY` - email delivery (magic links, verification, digests)
- `EMAIL_PREFERENCE_SECRET` - signing secret for one-click digest unsubscribe links
- `BULLMQ_REDIS_URL` - Redis connection for weekly emails, notifications, and scheduled jobs
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` - durable image/video storage (recommended)
- `UPLOADS_DIR` - path on a persistent mounted volume for local file storage; production uploads fail clearly if neither this nor Cloudinary is configured
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - GitHub OAuth
- `API_URL` - public API origin used for provider callback URLs; set the GitHub OAuth App callback URL to `${API_URL}/api/auth/oauth/github/callback`. `APP_URL` should remain the frontend origin for the post-login redirect.

Optional verification providers:
- `IDENTITY_VERIFICATION_PROVIDER_KEY` - required only when `identity_verification_enabled` is enabled
- `SMS_PROVIDER_API_KEY` - required only when `phone_verification_enabled` is enabled

## Error monitoring

Create Sentry projects for the API and browser, then set these in production:

- Render API runtime: `SENTRY_DSN` (API project DSN), `SENTRY_ENVIRONMENT=production`, and optionally `SENTRY_TRACES_SAMPLE_RATE=0.05`.
- Cloudflare Pages build environment: `VITE_SENTRY_DSN` (browser project DSN), `VITE_SENTRY_ENVIRONMENT=production`, and optionally `VITE_SENTRY_TRACES_SAMPLE_RATE=0.05`.

The Vite variables are embedded at build time, so trigger a new frontend build after setting them. DSNs are public ingestion identifiers, not authentication secrets. The API and browser DSNs may be separate projects to keep their issue streams distinct. Without a DSN, Sentry stays disabled and application behavior is unchanged.

To receive notifications rather than only see events in Sentry, create an Issue Alert for each project: trigger on a new issue in the `production` environment and notify the team by email or Slack. The API reports Express errors, error-level Pino logs (including failed BullMQ jobs), startup errors, and unhandled exceptions. The browser reports uncaught exceptions, React render failures, network failures, and API 5xx responses; expected 4xx responses are excluded.

Verify capture without sending a production event:

```sh
pnpm --dir apps/api exec vitest run src/__tests__/sentry.test.ts
```

This test runs with `NODE_ENV=test`, generates a deliberate failed-job error, and asserts that its Sentry envelope reaches a local test receiver.

## Services

| Service | Port | Purpose |
|---------|------|---------|
| API | 9000 | Express REST + Socket.io |
| Web | 5000 | React SPA (Vite) |
| Public Web | 3001 | SEO/OG server + landing page |
