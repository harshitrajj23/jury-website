import { NextRequest } from "next/server";
import { subscribeMemoryBus, RealtimePayload, getRedis } from "@/lib/redisClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const safeEnqueue = (chunk: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch (e) {
          isClosed = true;
        }
      };

      // Send initial connected message
      safeEnqueue(`event: connected\ndata: ${JSON.stringify({ status: "connected", time: Date.now() })}\n\n`);

      // 1. Subscribe to in-memory bus (instant local dispatch)
      const unsubscribeMemory = subscribeMemoryBus((event: RealtimePayload) => {
        safeEnqueue(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
      });

      // 2. Cross-instance Redis sync check (if Redis is configured)
      let lastSeenTimestamp = Date.now();
      const redis = getRedis();
      let redisPollInterval: NodeJS.Timeout | null = null;

      if (redis) {
        redisPollInterval = setInterval(async () => {
          if (isClosed) return;
          try {
            const lastEventRaw = await redis.get("jury_last_event");
            if (lastEventRaw) {
              const lastEvent: RealtimePayload =
                typeof lastEventRaw === "string" ? JSON.parse(lastEventRaw) : (lastEventRaw as any);
              if (lastEvent && lastEvent.timestamp > lastSeenTimestamp) {
                lastSeenTimestamp = lastEvent.timestamp;
                safeEnqueue(`event: change\ndata: ${JSON.stringify(lastEvent)}\n\n`);
              }
            }
          } catch (e) {
            // Ignore Redis poll error
          }
        }, 1200);
      }

      // 3. Keep-alive heartbeat every 15 seconds
      const heartbeatInterval = setInterval(() => {
        if (isClosed) return;
        safeEnqueue(`: ping ${Date.now()}\n\n`);
      }, 15000);

      // Clean up when client disconnects
      req.signal.addEventListener("abort", () => {
        isClosed = true;
        unsubscribeMemory();
        if (redisPollInterval) clearInterval(redisPollInterval);
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch (e) {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
