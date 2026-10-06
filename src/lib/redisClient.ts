import { Redis } from "@upstash/redis";

let redisInstance: Redis | null = null;

// Global in-memory broadcast bus for fast local/same-instance dispatch
type EventSubscriber = (event: RealtimePayload) => void;
const memorySubscribers = new Set<EventSubscriber>();

export interface RealtimePayload {
  table: "Score" | "Team" | "User" | "Criteria" | "Settings" | "AuditLog" | "Event";
  action: string;
  timestamp: number;
  eventId?: string;
  data?: any;
}

export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN;

  if (!url || !token) {
    return null;
  }

  if (!redisInstance) {
    try {
      redisInstance = new Redis({
        url: url.trim().replace(/^["']|["']$/g, ''),
        token: token.trim().replace(/^["']|["']$/g, ''),
      });
    } catch (e) {
      console.warn("⚠️ Failed to initialize Upstash Redis:", e);
      return null;
    }
  }

  return redisInstance;
}

export function subscribeMemoryBus(subscriber: EventSubscriber): () => void {
  memorySubscribers.add(subscriber);
  return () => {
    memorySubscribers.delete(subscriber);
  };
}

/**
 * Broadcasts a database mutation event across Redis and in-memory streams.
 */
export async function broadcastRealtimeEvent(payload: Omit<RealtimePayload, "timestamp">): Promise<void> {
  const fullPayload: RealtimePayload = {
    ...payload,
    timestamp: Date.now(),
  };

  // 1. Dispatch to local memory subscribers (instant 0ms)
  memorySubscribers.forEach((sub) => {
    try {
      sub(fullPayload);
    } catch (e) {
      console.error("Memory bus subscriber error:", e);
    }
  });

  // 2. Publish to Upstash Redis if configured
  try {
    const redis = getRedis();
    if (redis) {
      const channel = "jury_realtime_events";
      const jsonStr = JSON.stringify(fullPayload);
      await redis.publish(channel, jsonStr);
      await redis.set("jury_last_update_ts", fullPayload.timestamp);
      await redis.set("jury_last_event", jsonStr);
    }
  } catch (err) {
    // Non-blocking error
    console.warn("⚠️ Redis publish warning:", err);
  }
}
