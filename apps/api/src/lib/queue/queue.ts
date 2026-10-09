import { Queue } from "bullmq";
import IORedis from "ioredis";
import { logger } from "../logger";

export type JobName =
  | "send_notification"
  | "process_image"
  | "ai_generate"
  | "update_trust_score"
  | "publish_scheduled_post"
  | "send_digest_email"
  | "lock_ab_winner"
  | "send_topic_notification"
  | "admin_notification_broadcast"
  | "expire_boosts"
  | "streak_break_check";

export interface JobPayloads {
  send_notification: {
    userId: number;
    type: string;
    actorId: number;
    postId?: number;
    message: string;
    notifId?: number;
  };
  process_image: {
    userId: number;
    imageUrl: string;
    type: "avatar" | "cover" | "gallery";
  };
  ai_generate: {
    userId: number;
    prompt: string;
    model?: string;
    requestId: string;
  };
  update_trust_score: {
    userId: number;
    reason?: string;
  };
  publish_scheduled_post: {
    postId: number;
  };
  send_digest_email: {
    userId: number;
  };
  lock_ab_winner: {
    postId: number;
  };
  send_topic_notification: {
    topicId: number;
    postId: number;
    authorId: number;
  };
  admin_notification_broadcast: {
    actorId: number;
    title: string;
    message: string;
  };
  expire_boosts: Record<string, never>;
  streak_break_check: Record<string, never>;
}

let jobQueue: Queue | null = null;

export function createBullMQConnection(): IORedis {
  const redisUrl = process.env.BULLMQ_REDIS_URL;
  return redisUrl
    ? new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        tls: redisUrl.startsWith("rediss://")
          ? { rejectUnauthorized: false }
          : undefined,
      })
    : new IORedis({
        host: "localhost",
        port: 6379,
        maxRetriesPerRequest: null,
      });
}

export function getQueue(): Queue | null {
  if (jobQueue) return jobQueue;

  // BullMQ requires a raw TCP Redis connection (ioredis).
  try {
    const connection = createBullMQConnection();
    jobQueue = new Queue("quillhive-jobs", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
    logger.info("Job queue initialized");
    return jobQueue;
  } catch (err) {
    logger.error({ err }, "Failed to create job queue");
    return null;
  }
}

export async function addJob<N extends JobName>(
  name: N,
  data: JobPayloads[N]
): Promise<string | null> {
  const queue = getQueue();
  if (!queue) return null;

  try {
    const job = await queue.add(name, data);
    return job.id ?? null;
  } catch (err) {
    logger.error({ err, name }, "Failed to add job");
    return null;
  }
}
