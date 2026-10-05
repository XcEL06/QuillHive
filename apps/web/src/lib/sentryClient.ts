type SentryClient = typeof import("@sentry/react");
type ClientCaptureContext = Parameters<SentryClient["captureException"]>[1];

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
let sentryPromise: Promise<SentryClient> | null = null;

function loadSentry(): Promise<SentryClient> {
  if (!sentryPromise) sentryPromise = import("@sentry/react");
  return sentryPromise;
}

export function initializeSentryClient(): void {
  if (!dsn) return;
  void loadSentry().then(Sentry => Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.data;
      }
      return event;
    },
  })).catch(() => {});
}

export function captureBrowserException(error: unknown, context?: ClientCaptureContext): void {
  if (!dsn) return;
  void loadSentry().then(Sentry => Sentry.captureException(error, context)).catch(() => {});
}