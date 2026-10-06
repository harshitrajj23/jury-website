"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseRealtimeSyncOptions {
  /** Tables / keys to monitor for sync, e.g. ["Score", "Team", "Settings"] or ["*"] */
  tables: string[];
  /** Callback fired when data sync is triggered */
  onDataChange: () => void;
  /** Whether the sync connection should be active (default: true) */
  enabled?: boolean;
  /** Fallback background polling interval in milliseconds when SSE is offline (default: 20000ms) */
  intervalMs?: number;
}

/**
 * React hook that provides sub-second live real-time sync with Neon Postgres & Redis.
 * Connects to Server-Sent Events (SSE) `/api/realtime/sse` for instant push notifications (<50ms).
 * Operates adaptive fallback polling ONLY when SSE is offline or disconnected, avoiding request storms.
 *
 * Returns the live connection status ("connected" | "connecting" | "disconnected") for UI indicators.
 */
export function useRealtimeSync({
  tables,
  onDataChange,
  enabled = true,
  intervalMs = 20000,
}: UseRealtimeSyncOptions): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const onDataChangeRef = useRef(onDataChange);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tablesRef = useRef(tables);
  const statusRef = useRef<ConnectionStatus>("connecting");

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  const triggerChange = useCallback((immediate: boolean = false) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (immediate) {
      onDataChangeRef.current();
    } else {
      debounceRef.current = setTimeout(() => {
        onDataChangeRef.current();
      }, 100);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("disconnected");
      statusRef.current = "disconnected";
      return;
    }

    let eventSource: EventSource | null = null;
    let isSubscribed = true;

    try {
      eventSource = new EventSource("/api/realtime/sse");

      eventSource.onopen = () => {
        if (isSubscribed) {
          setStatus("connected");
          statusRef.current = "connected";
        }
      };

      // Listen for data change events dispatched from server
      eventSource.addEventListener("change", (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          const monitoredTables = tablesRef.current;
          // If no specific tables given, or table matches, or wildcard
          if (
            monitoredTables.length === 0 ||
            monitoredTables.includes("*") ||
            monitoredTables.includes(payload.table)
          ) {
            triggerChange(true); // Instant sub-50ms update
          }
        } catch (e) {
          triggerChange();
        }
      });

      // Handle connected handshake
      eventSource.addEventListener("connected", () => {
        if (isSubscribed) {
          setStatus("connected");
          statusRef.current = "connected";
        }
      });

      eventSource.onerror = () => {
        if (isSubscribed) {
          setStatus("connecting");
          statusRef.current = "connecting";
        }
      };
    } catch (err) {
      console.warn("Realtime SSE connection fallback to polling:", err);
      setStatus("connecting");
      statusRef.current = "connecting";
    }

    // Adaptive safety-net fallback polling ONLY if SSE is disconnected/connecting
    const interval = setInterval(() => {
      if (statusRef.current !== "connected") {
        triggerChange();
      }
    }, intervalMs);

    // Instant sync when tab gains focus or becomes visible
    const handleFocus = () => triggerChange(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerChange(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isSubscribed = false;
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, intervalMs, triggerChange]);

  return status;
}
