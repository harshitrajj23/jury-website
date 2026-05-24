/**
 * Realtime WebSocket Verification Script
 * 
 * Tests that Supabase Realtime (WebSocket) is receiving live change events.
 * 1. Connects to Supabase Realtime channel
 * 2. Subscribes to pals_teams table for INSERT events
 * 3. Inserts a test row
 * 4. Waits for the realtime event to fire
 * 5. Cleans up the test row
 * 6. Reports pass/fail
 */

require('dotenv').config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TEST_TEAM_ID = `test_ws_${Date.now()}`;
const TEST_TEAM_NAME = `__WS_TEST_TEAM_${Date.now()}`;
const TIMEOUT_MS = 10000;

async function main() {
  console.log("🔌 SCORESPHERE WebSocket Realtime Verification");
  console.log("━".repeat(50));
  console.log(`📡 Supabase URL: ${supabaseUrl}`);
  console.log(`🔑 Anon Key: ${supabaseAnonKey.slice(0, 20)}...`);
  console.log("");

  let realtimeReceived = false;
  let receivedPayload = null;

  // Step 1: Subscribe to Realtime channel
  console.log("⏳ Step 1: Subscribing to pals_teams Realtime channel...");

  const channel = supabase
    .channel("ws-test-channel")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "pals_teams",
      },
      (payload) => {
        console.log("🔔 Realtime listener callback triggered with payload:", JSON.stringify(payload, null, 2));
        if (payload.new && payload.new.id === TEST_TEAM_ID) {
          realtimeReceived = true;
          receivedPayload = payload;
          console.log("✅ Step 3: Realtime INSERT event RECEIVED via WebSocket!");
          console.log(`   → Table: ${payload.table}`);
          console.log(`   → Event: ${payload.eventType}`);
          console.log(`   → Data: id=${payload.new.id}, name=${payload.new.name}`);
        }
      }
    );

  const subscribeResult = await new Promise((resolve) => {
    channel.subscribe((status) => {
      console.log(`   → Channel status: ${status}`);
      if (status === "SUBSCRIBED") resolve("ok");
      if (status === "CHANNEL_ERROR") resolve("error");
      if (status === "CLOSED") resolve("closed");
    });

    // Timeout if subscription takes too long
    setTimeout(() => resolve("timeout"), 5000);
  });

  if (subscribeResult !== "ok") {
    console.error(`❌ Channel subscription failed: ${subscribeResult}`);
    console.error("   Check that Realtime is enabled on pals_teams in Supabase Dashboard.");
    await supabase.removeChannel(channel);
    process.exit(1);
  }

  console.log("✅ Step 1: Channel subscribed successfully.");
  console.log("");

  // Step 2: Insert a test row
  console.log("⏳ Step 2: Inserting test team row...");
  const { error: insertError } = await supabase
    .from("pals_teams")
    .insert([{ id: TEST_TEAM_ID, name: TEST_TEAM_NAME }]);

  if (insertError) {
    console.error(`❌ Insert failed: ${insertError.message}`);
    await supabase.removeChannel(channel);
    process.exit(1);
  }
  console.log(`✅ Step 2: Test row inserted (id: ${TEST_TEAM_ID})`);
  console.log("");

  // Step 3: Wait for realtime event
  console.log(`⏳ Step 3: Waiting up to ${TIMEOUT_MS / 1000}s for Realtime event...`);

  const startTime = Date.now();
  while (!realtimeReceived && Date.now() - startTime < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("");

  // Step 4: Cleanup
  console.log("⏳ Step 4: Cleaning up test row...");
  const { error: deleteError } = await supabase
    .from("pals_teams")
    .delete()
    .eq("id", TEST_TEAM_ID);

  if (deleteError) {
    console.warn(`⚠️  Cleanup warning: ${deleteError.message}`);
  } else {
    console.log("✅ Step 4: Test row deleted.");
  }

  // Unsubscribe
  await supabase.removeChannel(channel);
  console.log("");

  // Final Report
  console.log("━".repeat(50));
  if (realtimeReceived) {
    console.log("🎉 RESULT: PASS — WebSocket Realtime is working correctly!");
    console.log("   Live change events are being received in real-time.");
    process.exit(0);
  } else {
    console.log("❌ RESULT: FAIL — No Realtime event received within timeout.");
    console.log("");
    console.log("   Troubleshooting:");
    console.log("   1. Go to Supabase Dashboard → Database → Replication");
    console.log("   2. Ensure 'pals_teams' has Realtime ENABLED");
    console.log("   3. Ensure RLS is OFF (or has permissive policies)");
    console.log("   4. Check that your Supabase project plan supports Realtime");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
