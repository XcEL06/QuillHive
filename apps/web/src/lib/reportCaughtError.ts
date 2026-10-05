import { captureBrowserException } from "./sentryClient";

export function reportCaughtError(error: unknown, context: Record<string, unknown>): void {
  const status = error && typeof error === "object" && "status" in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
  if (status !== undefined && status >= 400 && status < 500) return;

  const exception = error instanceof Error ? error : new Error(String(error));
  captureBrowserException(exception, {
    tags: { source: "caught_frontend_error" },
    extra: context,
  });
}