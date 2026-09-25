import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupSocket } from "./lib/socket";
import { runSeed } from "./scripts/seed";
import { startWorker } from "./lib/queue/worker";
import { startScheduling } from "./features/scheduling/scheduling.service";
import { initSentry } from "./lib/sentry";
import { startDailyDigest, startAnomalyMonitor } from "./lib/alertEngine";
import { seedFeatureFlags } from "./lib/featureFlags";
import { testConnection } from "@workspace/db";
import { logAiConfiguration } from "./routes/ai";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const dbReady = await testConnection();
if (!dbReady) {
  logger.error("Database connection failed on startup - exiting");
  process.exit(1);
}
logger.info("Database connection verified");
logAiConfiguration();

// Validate JWT_SECRET early
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  if (process.env.NODE_ENV === "production") {
    logger.error("JWT_SECRET must be set to at least 32 characters in production - exiting");
    process.exit(1);
  }
  logger.warn("JWT_SECRET not properly configured; using development default");
}
logger.info("JWT configuration verified");

await seedFeatureFlags();
logger.info("Feature flags seeded");

const httpServer = createServer(app);
setupSocket(httpServer);

startWorker();
startScheduling();
void initSentry();
startDailyDigest();
startAnomalyMonitor();

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  runSeed().catch((e) => logger.error({ err: e }, "Platform seed failed"));
});
