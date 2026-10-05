import pino from "pino";
import { captureError, captureMessage } from "./sentry";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
    hooks: {
      logMethod(args, method, level) {
        if (level >= 50) {
          const errorArg = args.find((value) => value instanceof Error)
            ?? args.find((value) => value && typeof value === "object" && "err" in value && (value as { err?: unknown }).err instanceof Error) as { err?: Error } | undefined;
          const message = [...args].reverse().find((value): value is string => typeof value === "string");
          const fields = args.find((value) => value && typeof value === "object" && !(value instanceof Error)) as Record<string, unknown> | undefined;
          const extra = Object.fromEntries(["jobId", "name", "path", "method", "status", "statusCode", "userId", "postId"]
            .flatMap((key) => fields?.[key] === undefined ? [] : [[key, fields[key]]]));
          if (errorArg) {
            captureError(errorArg instanceof Error ? errorArg : errorArg.err, { tags: { source: "pino" }, extra: { message, ...extra } });
          } else {
            captureMessage(message ?? "Error-level server log", { tags: { source: "pino" }, extra });
          }
        }
        method.apply(this, args);
      },
    },
});
