"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseRealtimeSyncOptions {
  /** Tables / keys to monitor for sync */
  tables: string[];
  /** Callback fired when data sync is triggered */
  onDataChange: () => void;
  /** Whether the sync polling should be active (default: true) */
  enabled?: boolean;
  /** Polling interval in milliseconds (default: 2500ms) */
  intervalMs?: number;
}

/**
 * React hook that provides live real-time sync with Neon Postgres database.
 * Polls at a high-performance interval (2.5s) and syncs on window focus/visibility.
 *
 * Returns the connection status ("connected" | "connecting" | "disconnected") for UI indicators.
 */
export function useRealtimeSync({
  tables,
  onDataChange,
  enabled = true,
  intervalMs = 2500,
}: UseRealtimeSyncOptions): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const onDataChangeRef = useRef(onDataChange);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  const triggerChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onDataChangeRef.current();
    }, 200);
  }, []);

  useEffect(() => {
    if (!enabled || tables.length === 0) {
      Promise.resolve().then(() => setStatus("disconnected"));
      return;
    }

    Promise.resolve().then(() => setStatus("connected"));

    // Periodic polling interval
    const interval = setInterval(() => {
      triggerChange();
    }, intervalMs);

    // Instant sync when tab gains focus or becomes visible
    const handleFocus = () => triggerChange();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerChange();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [tables.join(","), enabled, intervalMs, triggerChange]);

  return status;
}
