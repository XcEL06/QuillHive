import { logger } from "../../lib/logger";

export interface RetryOptions {
  attempts?: number;
  initialDelayMs?: number;
  wait?: (delayMs: number) => Promise<void>;
}

const waitFor = (delayMs: number) => new Promise<void>(resolve => setTimeout(resolve, delayMs));

export async function runScheduledJob<T>(
  jobName: string,
  job: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 3));
  const initialDelayMs = Math.max(0, options.initialDelayMs ?? 1_000);
  const wait = options.wait ?? waitFor;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await job();
    } catch (error) {
      if (attempt === attempts) {
        logger.error({ err: error, name: jobName, attempts }, "Scheduled job failed after retries");
        throw error;
      }

      const delayMs = initialDelayMs * 2 ** (attempt - 1);
      logger.warn({ err: error, name: jobName, attempt, nextAttempt: attempt + 1, delayMs }, "Scheduled job failed; retrying");
      await wait(delayMs);
    }
  }

  throw new Error(`Scheduled job ${jobName} exited without a result`);
}