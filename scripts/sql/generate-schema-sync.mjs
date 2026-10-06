import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const dbPackage = path.join(repoRoot, "packages/utils/db");
const outputPath = path.join(scriptDir, "../../database/schema_sync.sql");
const overviewPath = path.join(scriptDir, "../../PROJECT_OVERVIEW.md");

const exportedSql = execFileSync(
  "pnpm",
  [
    "exec",
    "drizzle-kit",
    "export",
    "--dialect",
    "postgresql",
    "--schema",
    "./src/schema/index.ts",
  ],
  { cwd: dbPackage, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);

const tablePattern = /CREATE TABLE ("[^"]+") \(([\s\S]*?)\n\);/g;
const tables = [];
for (const match of exportedSql.matchAll(tablePattern)) {
  const [, name, body] = match;
  const columns = [];
  const uniqueConstraints = [];
  const primaryKeyConstraints = [];

  for (const line of body.split("\n")) {
    const definition = line.trim().replace(/,$/, "");
    if (!definition) continue;
    const column = definition.match(/^("[^"]+")\s+(.+)$/);
    if (column) {
      const [, columnName, columnDefinition] = column;
      const isPrimaryKey = /\bPRIMARY KEY\b/i.test(columnDefinition);
      const addDefinition = columnDefinition
        .replace(/\s+PRIMARY KEY\b/i, "")
        .replace(/\s+UNIQUE\b/i, "");
      const hasSafeDefault =
        /\bDEFAULT\b/i.test(addDefinition) ||
        /\bserial\b/i.test(addDefinition) ||
        /\bGENERATED\s+(?:ALWAYS|BY DEFAULT)\s+AS IDENTITY\b/i.test(addDefinition);
      const safeAddDefinition = hasSafeDefault
        ? addDefinition
        : addDefinition.replace(/\s+NOT NULL\b/i, "");

      columns.push({ name: columnName, definition: safeAddDefinition });
      if (isPrimaryKey) primaryKeyConstraints.push(columnName);
      continue;
    }

    const unique = definition.match(/^CONSTRAINT "([^"]+)" UNIQUE\((.+)\)$/i);
    if (unique) {
      uniqueConstraints.push({ name: unique[1], columns: unique[2] });
      continue;
    }

    const primaryKey = definition.match(/^CONSTRAINT "([^"]+)" PRIMARY KEY\((.+)\)$/i);
    if (primaryKey) {
      primaryKeyConstraints.push(...primaryKey[2].match(/"[^"]+"/g));
      continue;
    }

    if (!definition.startsWith("CONSTRAINT ")) {
      throw new Error(`Unrecognized table definition for ${name}: ${definition}`);
    }
  }

  tables.push({
    name,
    create: match[0].replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS "),
    columns,
    uniqueConstraints,
    primaryKeyConstraints,
  });
}

if (tables.length === 0) {
  throw new Error("Drizzle export did not contain any PostgreSQL tables.");
}

const foreignKeys = [
  ...exportedSql.matchAll(
    /^ALTER TABLE ("[^"]+") ADD CONSTRAINT ("[^"]+") FOREIGN KEY \(([^)]+)\) REFERENCES ([\s\S]+?);$/gm,
  ),
].map(([, table, constraint, columns, reference]) => ({
  table,
  constraint,
  columns,
  reference,
}));

const indexes = [
  ...exportedSql.matchAll(/^CREATE (UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"([\s\S]*?);$/gm),
].map(([, unique, name, table, definition]) => ({
  unique: Boolean(unique),
  name,
  table,
  definition,
}));

function readSource(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const text = fs.readFileSync(absolutePath, "utf8");
  return ts.createSourceFile(absolutePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function exportedRouters(relativePath) {
  const sourceFile = readSource(relativePath);
  const names = new Map();
  for (const statement of sourceFile.statements) {
    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.set(declaration.name.text, declaration.name.text);
      }
    }
    if (
      ts.isExportAssignment(statement) &&
      ts.isIdentifier(statement.expression)
    ) {
      names.set("default", statement.expression.text);
    }
  }
  return names;
}

function importsFrom(sourceFile) {
  const imports = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const modulePath = statement.moduleSpecifier.text;
    const resolvedFile = path.resolve(path.dirname(sourceFile.fileName), `${modulePath}.ts`);
    const relativeFile = path.relative(repoRoot, resolvedFile);
    if (statement.importClause?.name) {
      imports.set(statement.importClause.name.text, {
        file: relativeFile,
        exportedName: "default",
      });
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        imports.set(element.name.text, {
          file: relativeFile,
          exportedName: element.propertyName?.text ?? element.name.text,
        });
      }
    }
  }
  return imports;
}

function routeMounts(relativePath, basePrefix, mountPrefix, routerVariable = "router") {
  const sourceFile = readSource(relativePath);
  const imports = importsFrom(sourceFile);
  const mounts = new Map();
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "use" &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === routerVariable
    ) {
      const args = node.arguments;
      const target = args.at(-1);
      if (target && ts.isIdentifier(target)) {
        const imported = imports.get(target.text);
        const localPrefix =
          args.length > 1 && ts.isStringLiteral(args[0]) ? args[0].text : "";
        if (imported) {
          const key = `${imported.file}:${imported.exportedName}`;
          const prefix = [basePrefix, mountPrefix, localPrefix]
            .filter(Boolean)
            .join("/")
            .replace(/\/+/g, "/");
          const previous = mounts.get(key) ?? [];
          previous.push(prefix);
          mounts.set(key, previous);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return mounts;
}

function apiRouteEntries() {
  const apiIndexPath = "apps/api/src/routes/index.ts";
  const appPath = "apps/api/src/app.ts";
  const mounts = new Map([
    ...routeMounts(apiIndexPath, "/api", "").entries(),
    ...routeMounts(appPath, "", "", "app").entries(),
  ]);
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(path.join(repoRoot, directory), { withFileTypes: true })) {
      const relativePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "tests" && entry.name !== "__tests__") walk(relativePath);
      } else if (
        relativePath.endsWith(".ts") &&
        !relativePath.includes("/tests/") &&
        !relativePath.includes("/__tests__/")
      ) {
        files.push(relativePath);
      }
    }
  };
  walk("apps/api/src");

  const entries = [];
  for (const relativePath of files) {
    const sourceFile = readSource(relativePath);
    const exports = exportedRouters(relativePath);
    const routerVariables = new Map([...exports].map(([exportedName, localName]) => [localName, exportedName]));
    const findLocalRouters = (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ((ts.isIdentifier(node.initializer.expression) &&
          node.initializer.expression.text === "Router") ||
          (ts.isPropertyAccessExpression(node.initializer.expression) &&
            node.initializer.expression.name.text === "Router"))
      ) {
        if (!routerVariables.has(node.name.text)) {
          routerVariables.set(node.name.text, `unexported:${node.name.text}`);
        }
      }
      ts.forEachChild(node, findLocalRouters);
    };
    findLocalRouters(sourceFile);
    const fileEntries = [];
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ["get", "post", "put", "patch", "delete"].includes(node.expression.name.text) &&
        ts.isIdentifier(node.expression.expression)
      ) {
        const variable = node.expression.expression.text;
        const exportedName = routerVariables.get(variable);
        if (exportedName) {
          const defaultPrefix = relativePath === appPath ? "" : "/api";
          const knownPrefixes = mounts.get(`${relativePath}:${exportedName}`);
          const isDirectAppRoute = relativePath === appPath && variable === "app";
          const isMainApiRouter = relativePath === apiIndexPath && variable === "router";
          const unmounted =
            exportedName.startsWith("unexported:") ||
            (!knownPrefixes && !isDirectAppRoute && !isMainApiRouter);
          const prefixes = knownPrefixes ?? [defaultPrefix];
          const routePaths = [];
          const firstArgument = node.arguments[0];
          if (firstArgument && ts.isStringLiteralLike(firstArgument)) {
            routePaths.push(firstArgument.text);
          } else if (firstArgument && ts.isArrayLiteralExpression(firstArgument)) {
            for (const element of firstArgument.elements) {
              if (ts.isStringLiteralLike(element)) routePaths.push(element.text);
              else routePaths.push(element.getText(sourceFile));
            }
          } else {
            routePaths.push(firstArgument?.getText(sourceFile) ?? "[path expression]");
          }
          for (const prefix of prefixes.length ? prefixes : ["/api"]) {
            for (const routePath of routePaths) {
              const fullPath = `${prefix}/${routePath}`.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
              fileEntries.push({
                method: node.expression.name.text.toUpperCase(),
                path: fullPath,
                relativePath,
                unmounted,
              });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    entries.push(...fileEntries);
  }
  return entries.sort(
    (left, right) =>
      left.relativePath.localeCompare(right.relativePath) ||
      left.path.localeCompare(right.path) ||
      left.method.localeCompare(right.method),
  );
}

const routeActionDescriptions = {
  login: "Authenticate a user",
  logout: "End a user session",
  register: "Register a user",
  signup: "Create an account",
  refresh: "Refresh authentication",
  verify: "Verify the requested resource or transaction",
  consume: "Consume a one-time token",
  request: "Submit a request",
  apply: "Submit an application",
  vote: "Record a vote",
  report: "Submit a report",
  send: "Send a message or notification",
  read: "Mark content as read",
  acknowledge: "Acknowledge a notice",
  publish: "Publish scheduled content",
  unpublish: "Unpublish content",
  approve: "Approve a request",
  reject: "Reject a request",
  dismiss: "Dismiss a report",
  resolve: "Resolve a report",
  start: "Start the requested operation",
  complete: "Complete the requested operation",
  enable: "Enable the requested feature",
  disable: "Disable the requested feature",
  setup: "Set up the requested feature",
  reset: "Reset the requested settings",
  authenticate: "Authenticate a user",
  appreciate: "Record an appreciation",
  revoke: "Revoke the requested access or promotion",
  unpromote: "Remove a group promotion",
  unsponsor: "Remove a post sponsorship",
  search: "Search the requested resources",
  count: "Return a count",
  "unread-count": "Return the unread count",
  seen: "Mark conversation messages as seen",
};

function routePurpose(method, routePath) {
  const segments = routePath.split("/").filter((segment) => segment && segment !== "api");
  const last = segments.at(-1) ?? "resource";
  const action = routeActionDescriptions[last];
  if (action) return `${action}${segments.length > 1 ? ` (${segments.slice(0, -1).join(" ")})` : ""}.`;
  const resource = segments
    .filter((segment) => !segment.startsWith(":"))
    .slice(-2)
    .join(" ")
    .replaceAll("-", " ") || "API resource";
  if (method === "GET") return `Read or list ${resource}.`;
  if (method === "POST") return `Create or submit ${resource}.`;
  if (method === "PATCH" || method === "PUT") return `Update ${resource}.`;
  return `Remove ${resource}.`;
}

const tablePurposes = {
  users: "User accounts, public profiles, preferences, and account state.",
  follows: "Directed follow relationships between users.",
  email_verification_tokens: "One-time email verification tokens.",
  blocked_email_attempts: "Rejected signup email attempts and reputation signals.",
  work_history: "User-entered employment history.",
  education_history: "User-entered education history.",
  sessions: "Authenticated user sessions and token hashes.",
  revoked_tokens: "Revoked authentication tokens retained until expiry.",
  login_events: "Authentication and login-integrity event history.",
  posts: "Long-form and short-form authored content and publication state.",
  comments: "Comments and replies on posts.",
  comment_likes: "User likes on comments.",
  likes: "User likes on posts.",
  post_shares: "Post share events and source/click counts.",
  reposts: "User repost relationships.",
  saved_posts: "Posts saved by users.",
  conversations: "Direct-message conversation records.",
  conversation_participants: "Users participating in conversations and read state.",
  messages: "Messages exchanged in conversations.",
  conversation_payment_proposals: "Payment proposals sent within conversations.",
  groups: "Community group configuration and visibility.",
  group_members: "Group membership, roles, and status.",
  group_post_details: "Group-specific post type, moderation, and pinned state.",
  group_join_requests: "Membership requests and screening responses.",
  group_invites: "Group invitations and their expiration/state.",
  group_bans: "Users banned from specific groups.",
  group_pinned_posts: "Posts pinned within groups.",
  group_activity_logs: "Auditable group moderation and membership activity.",
  jobs: "Posted work opportunities.",
  opportunity_applications: "Applications submitted to opportunities.",
  notifications: "In-app notification records and read state.",
  reports: "User-submitted moderation reports.",
  moderation_strikes: "Moderation strikes assigned to users.",
  admin_logs: "Administrative actions and audit records.",
  admin_notes: "Private moderator notes attached to users or content.",
  system_settings: "Runtime feature flags and system configuration.",
  uploaded_files: "Uploaded media metadata and storage references.",
  push_subscriptions: "Browser push notification subscriptions.",
  achievements: "Achievement definitions.",
  user_achievements: "Achievements earned by users.",
  writing_streaks: "Per-user writing streak totals and current streak.",
  writing_activity: "Daily post-writing activity used for streak calculations.",
  reading_progress: "Per-user progress through posts.",
  reading_streaks: "Per-user reading streak totals and current streak.",
  reading_activity: "Daily reading activity used for streak calculations.",
  polls: "Polls attached to posts.",
  poll_options: "Selectable options for polls.",
  poll_votes: "User selections in polls.",
  post_fingerprints: "Content fingerprints used for originality/reuse checks.",
  trust_scores: "Aggregated trust and reputation scores.",
  user_trust_scores: "Current trust score and component signals per user.",
  post_trust_scores: "Trust signals and scores per post.",
  behavior_events: "Behavioral signals used by trust and abuse detection.",
  reputation_events: "Reputation changes and their causes.",
  topics: "Discoverable topic definitions.",
  topic_follows: "Users following topics.",
  post_topics: "Topic associations for posts.",
  mentions: "User mentions extracted from content.",
  translation_cache: "Cached machine translations.",
  series: "Ordered collections of posts authored as a series.",
  collections: "User-curated post collections.",
  collection_posts: "Post membership and ordering within collections.",
  income_logs: "Creator income and payout ledger events.",
  post_versions: "Historical post content revisions.",
  collaboration_requests: "Collaboration invitations and decisions.",
  collaboration_rooms: "Workspaces for accepted collaborations.",
  collaboration_room_members: "Membership in collaboration rooms.",
  portfolio_items: "Creator portfolio entries.",
  creator_profiles: "Creator-specific profile and availability metadata.",
  support_tickets: "Support requests and ticket state.",
  support_messages: "Messages attached to support tickets.",
  safety_preferences: "Per-user safety and content-control settings.",
  moderation_rules: "Configurable content moderation rules.",
  api_keys: "User-managed credentials for the public API.",
  webhooks: "User webhook endpoint configuration and signing secrets.",
  webhook_deliveries: "Outbound webhook delivery attempts and outcomes.",
  invite_codes: "Referral/invitation codes and redemption state.",
  featured_slots: "Scheduled public featured-content slots.",
  magic_link_tokens: "One-time passwordless login tokens.",
  passkeys: "WebAuthn credentials registered to user accounts.",
  oauth_accounts: "External OAuth identities linked to user accounts.",
  challenges: "Writing challenge definitions and schedules.",
  challenge_submissions: "User submissions to writing challenges.",
  boost_requests: "Paid or moderated post promotion requests and payment state.",
  creator_subscription_plans: "Creator-defined subscription tiers.",
  creator_subscriptions: "Paid subscriber relationships to creators.",
  creator_tips: "Tips paid to creators.",
  service_listings: "Creator services available for hire.",
  commission_requests: "Commission requests and fulfillment status.",
  paid_post_access: "Paid access grants for premium posts.",
  creator_earnings: "Creator earnings ledger.",
  creator_payment_transactions: "Creator payment transactions and provider references.",
  skill_endorsements: "Skill endorsements between users.",
  creator_availability: "Creator availability and open-to-work status.",
  creator_similarity: "Computed similarity between creator accounts.",
  user_creator_affinity: "Personalized user-to-creator recommendation scores.",
  user_taste_profiles: "Aggregated user interests for content recommendations.",
  user_topic_affinity: "Personalized user-to-topic recommendation scores.",
  library_entries: "Public knowledge-library articles and metadata.",
  library_saves: "User bookmarks of library entries.",
  chains: "Collaborative post-chain metadata and settings.",
  chain_entries: "Posts contributed to collaborative chains.",
  profile_views: "Profile-view events and viewer attribution.",
  muted_users: "Per-user muted-account relationships.",
  spam_review_flags: "Spam-detection findings awaiting or recording review.",
};

function tableSource(tableName) {
  for (const file of fs.readdirSync(path.join(repoRoot, "packages/utils/db/src/schema"))) {
    if (!file.endsWith(".ts")) continue;
    const text = fs.readFileSync(path.join(repoRoot, "packages/utils/db/src/schema", file), "utf8");
    if (new RegExp(`pgTable\\s*\\(\\s*["'\`]${tableName}["'\`]`).test(text)) {
      return `packages/utils/db/src/schema/${file}`;
    }
  }
  return "packages/utils/db/src/schema/";
}

const tableOverview = tables
  .map(({ name }) => {
    const tableName = name.slice(1, -1);
    const purpose =
      tablePurposes[tableName] ??
      `Stores ${tableName.replaceAll("_", " ")} data for the associated feature.`;
    return `| \`${tableName}\` | ${purpose} | [schema](${tableSource(tableName)}) |`;
  })
  .join("\n");

const routeEntries = apiRouteEntries();
const routeGroups = new Map();
for (const entry of routeEntries) {
  const feature = entry.relativePath
    .replace("apps/api/src/", "")
    .replace(/\.routes?\.ts$|\.ts$/, "")
    .replaceAll("/", " / ");
  const group = routeGroups.get(feature) ?? [];
  group.push(entry);
  routeGroups.set(feature, group);
}
const routeOverview = [...routeGroups]
  .map(
    ([feature, entries]) =>
      `### ${feature}\n\n` +
      entries
        .map(
          ({ method, path: routePath, relativePath, unmounted }) =>
            `- ${unmounted ? "**UNMOUNTED** " : ""}\`${method} ${routePath}\` — ${routePurpose(method, routePath)} ([source](${relativePath})).`,
        )
        .join("\n"),
  )
  .join("\n\n");

const overview = `# QuillHive project overview

> Generated on ${new Date().toISOString().slice(0, 10)} from the checked-out source. Re-run \`pnpm project:snapshot\` to refresh both this file's route/database inventories and \`database/schema_sync.sql\`. Feature-state and gap assessments below are source audits and should be reviewed when implementation changes.

## Project shape

QuillHive is a pnpm TypeScript monorepo. The deployed API is an Express service in \`apps/api\`; the signed-in/public SPA is in \`apps/web\`; \`apps/public-web\` is a separate public-facing web application. Shared database types and Drizzle schema are in \`packages/utils/db\`; API client/spec packages live under \`packages/utils\`. PostgreSQL is the source of persisted application state, with optional Redis/cache and external media, email, AI, and payment integrations.

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

The API application mounts the main router at \`/api\`; public distribution endpoints mounted directly by the Express app have no \`/api\` prefix. Paths below are effective paths where the router mount is statically declared. **UNMOUNTED** marks route declarations not mounted by the inspected Express app/router composition. Purposes are concise summaries inferred from the route action/path; see source links for exact behavior and middleware.

${routeOverview}

## Database tables

Every PostgreSQL table exported from the current Drizzle schema index is listed below. Table purposes are summarized from the table names and feature schema; the linked source file is authoritative.

| Table | Purpose | TypeScript schema |
|---|---|---|
${tableOverview}

## Refreshing this snapshot

Run \`pnpm project:snapshot\` from the repository root. The command exports PostgreSQL DDL directly from \`packages/utils/db/src/schema/index.ts\`, regenerates the safe additive \`database/schema_sync.sql\`, and refreshes the route and table inventories in this file. Review the feature-state and known-gap prose above when functionality changes; those assessments are intentionally human-reviewed rather than inferred from filenames.
`;

const q = (value) => `'${value.replaceAll("'", "''")}'`;
const sections = [
  `-- Generated from packages/utils/db/src/schema/*.ts by scripts/sql/generate-schema-sync.mjs.
-- Refresh with: pnpm project:snapshot
-- Additive only: this file creates missing objects and never removes or rewrites data.
-- For existing tables, required columns without defaults are added nullable to preserve existing rows.
-- Unique indexes that conflict with existing duplicate values are skipped with a NOTICE.
-- Foreign keys are validated on empty tables and added NOT VALID on populated tables, preserving old data.
-- Existing column types/defaults and invalid historical foreign-key rows are not rewritten or repaired.

BEGIN;`,
  tables.map(({ create }) => create).join("\n\n"),
  tables
    .flatMap(({ name, columns }) =>
      columns.map(
        ({ name: column, definition }) => `DO $schema_sync$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = to_regclass(${q(name.slice(1, -1))}) AND relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE ${name} ADD COLUMN IF NOT EXISTS ${column} ${definition};
  ELSE
    RAISE NOTICE 'Skipped column ${column.slice(1, -1)}: ${name.slice(1, -1)} is not a table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped column ${column.slice(1, -1)} on ${name.slice(1, -1)}: %', SQLERRM;
END
$schema_sync$;`,
      ),
    )
    .join("\n"),
  tables
    .filter(({ primaryKeyConstraints }) => primaryKeyConstraints.length > 0)
    .map(({ name, primaryKeyConstraints }) => {
      const constraintName = `${name.slice(1, -1)}_pkey`;
      const columns = primaryKeyConstraints.join(", ");
      return `DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = ${q(name.slice(1, -1))}::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE ${name} ADD CONSTRAINT "${constraintName}" PRIMARY KEY (${columns});
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped primary key ${constraintName}: %', SQLERRM;
END
$schema_sync$;`;
    })
    .join("\n\n"),
  foreignKeys
    .map(
      ({ table, constraint, columns, reference }) => `DO $schema_sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = ${q(table.slice(1, -1))}::regclass AND conname = ${q(constraint.slice(1, -1))}
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM ${table} LIMIT 1) THEN
      ALTER TABLE ${table} ADD CONSTRAINT ${constraint} FOREIGN KEY (${columns}) REFERENCES ${reference.replace(/\s+NOT VALID$/, "")};
    ELSE
      ALTER TABLE ${table} ADD CONSTRAINT ${constraint} FOREIGN KEY (${columns}) REFERENCES ${reference.replace(/\s+NOT VALID$/, "")} NOT VALID;
      RAISE NOTICE 'Added foreign key ${constraint.slice(1, -1)} NOT VALID because ${table.slice(1, -1)} contains existing rows';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped foreign key ${constraint.slice(1, -1)}: %', SQLERRM;
END
$schema_sync$;`,
    )
    .join("\n\n"),
  [
    ...tables.flatMap(({ name, uniqueConstraints }) =>
      uniqueConstraints.map(({ name: indexName, columns }) => ({
        unique: true,
        name: indexName,
        table: name.slice(1, -1),
        definition: ` USING btree (${columns})`,
      })),
    ),
    ...indexes,
  ]
    .map(({ unique, name, table, definition }) => {
      const create = `CREATE ${unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS "${name}" ON "${table}"${definition};`;
      const catchUnique = unique
        ? `  WHEN unique_violation THEN
    RAISE NOTICE 'Skipped unique index ${name}: existing rows contain duplicate values';`
        : "";
      return `DO $schema_sync$
BEGIN
  ${create}
EXCEPTION
${catchUnique}${catchUnique ? "\n" : ""}  WHEN OTHERS THEN
    RAISE NOTICE 'Skipped ${unique ? "unique " : ""}index ${name}: %', SQLERRM;
END
$schema_sync$;`;
    })
    .join("\n\n"),
  "COMMIT;",
]
  .filter(Boolean);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${sections.join("\n\n")}\n`);
fs.writeFileSync(overviewPath, overview);
console.log(
  `Wrote ${path.relative(repoRoot, overviewPath)} (${routeEntries.length} routes, ${tables.length} tables) and ${path.relative(repoRoot, outputPath)} (${indexes.length + tables.reduce((count, table) => count + table.uniqueConstraints.length, 0)} indexes, ${foreignKeys.length} foreign keys).`,
);
