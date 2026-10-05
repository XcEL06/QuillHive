import * as Sentry from "@sentry/node";
import type { Express, ErrorRequestHandler } from "express";

type CaptureContext = Parameters<typeof Sentry.captureException>[1];
type MessageContext = Exclude<NonNullable<Parameters<typeof Sentry.captureMessage>[1]>, string>;

let initialized = false;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.data;
      }
      return event;
    },
  });
  initialized = true;
}

export function captureError(error: unknown, context?: CaptureContext): void {
  if (!initialized) return;
  try {
    Sentry.captureException(error, context);
  } catch {
    // Error reporting must never change the request or job outcome.
  }
}

export function captureMessage(message: string, context?: MessageContext): void {
  if (!initialized) return;
  try {
    Sentry.captureMessage(message, { level: "error", ...(context ?? {}) });
  } catch {
    // Error reporting must never change the request or job outcome.
  }
}

export function flushSentry(timeout = 2_000): Promise<boolean> {
  return initialized ? Sentry.flush(timeout) : Promise.resolve(true);
}

export function attachErrorHandler(app: Express): void {
  const handler: ErrorRequestHandler = (error, req, res, next) => {
    captureError(error, { extra: { url: req.url, method: req.method } });
    if (res.headersSent) return next(error);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(handler);
}
