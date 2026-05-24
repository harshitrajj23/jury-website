"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseRealtimeSyncOptions {
  /** Supabase table names to subscribe to */
  tables: string[];
  /** Callback fired when any subscribed table changes */
  onDataChange: () => void;
  /** Whether the subscription should be active (default: true) */
  enabled?: boolean;
}

/**
 * React hook that subscribes to Supabase Realtime (WebSocket) change events
 * on specified Postgres tables. Fires `onDataChange` callback (debounced 300ms)
 * when INSERT, UPDATE, or DELETE events are detected.
 *
 * Returns the current WebSocket connection status for UI display.
 */
export function useRealtimeSync({
  tables,
  onDataChange,
  enabled = true,
}: UseRealtimeSyncOptions): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable reference to the callback to avoid re-subscribing on every render
  const onDataChangeRef = useRef(onDataChange);
  onDataChangeRef.current = onDataChange;

  const debouncedChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onDataChangeRef.current();
    }, 300);
  }, []);

  useEffect(() => {
    if (!enabled || tables.length === 0) {
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");

    // Create a single channel with multiple table subscriptions
    const channelName = `realtime-sync-${tables.join("-")}-${Date.now()}`;
    let channel = supabase.channel(channelName);

    // Subscribe to postgres_changes for each table
    tables.forEach((table) => {
      channel = channel.on(
        "postgres_changes" as any,
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table,
        },
        () => {
          debouncedChange();
        }
      );
    });

    channel.subscribe((channelStatus) => {
      if (channelStatus === "SUBSCRIBED") {
        setStatus("connected");
      } else if (
        channelStatus === "CLOSED" ||
        channelStatus === "CHANNEL_ERROR"
      ) {
        setStatus("disconnected");
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount or when dependencies change
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tables.join(","), enabled, debouncedChange]);

  return status;
}
