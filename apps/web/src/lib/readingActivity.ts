export const READING_IDLE_TIMEOUT_MS = 30_000;

export function getActiveReadingDelta(
  now: number,
  lastTickAt: number,
  lastActivityAt: number,
  isVisible: boolean,
  isFocused: boolean,
): number {
  if (!isVisible || !isFocused) return 0;
  const activeUntil = Math.min(now, lastActivityAt + READING_IDLE_TIMEOUT_MS);
  return Math.max(0, activeUntil - lastTickAt);
}
