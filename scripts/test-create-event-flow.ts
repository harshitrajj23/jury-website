import dotenv from "dotenv";
dotenv.config();
import { neon } from "@neondatabase/serverless";
import {
  createEvent,
  deleteEvent,
  getEvents,
  getEvent,
  getConfig,
  getJudgePortalData,
} from "../src/lib/db";

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  console.log("==================================================");
  console.log("🎯 FOCUSED ACCEPTANCE TEST: CREATE EVENT FULL FLOW");
  console.log("==================================================\n");

  const results: { test: string; passed: boolean; details?: string }[] = [];
  function assert(test: string, passed: boolean, details?: string) {
    results.push({ test, passed, details });
    console.log(`[${passed ? "PASS" : "FAIL"}] ${test}`);
    if (details) console.log(`   └─ ${details}`);
    if (!passed) throw new Error(`Test failed: ${test} - ${details}`);
  }

  const testEventPayload = {
    name: "Sync Test Hackathon 2026",
    subtitle: "Innovation & Robotics",
    organizer: "Robotics Club",
    logo: "https://example.com/logo.png",
    organizerLogo: "https://example.com/org-logo.png",
    banner: "https://example.com/banner.png",
    date: "2026-11-20",
    theme: "Cybernetics",
    status: "active",
  };

  let createdId = "";

  try {
    // 1. Create Event via createEvent
    console.log("1. Creating event via createEvent()...");
    const res = await createEvent(testEventPayload);
    assert("createEvent succeeds with ActionResult success=true", res.success === true && !!res.data?.id, `Event ID: ${res.data?.id}`);
    createdId = res.data!.id;

    // 2. Verify Event in Database
    console.log("\n2. Verifying Event record in Database...");
    const dbEvent = await getEvent(createdId);
    assert("Event persisted with exact name", dbEvent?.name === testEventPayload.name, `Name: ${dbEvent?.name}`);
    assert("Event persisted with exact organizer", dbEvent?.organizer === testEventPayload.organizer, `Organizer: ${dbEvent?.organizer}`);
    assert("Event persisted with exact banner", dbEvent?.banner === testEventPayload.banner, `Banner: ${dbEvent?.banner}`);
    assert("Event persisted with active=true", dbEvent?.active === true, `Active: ${dbEvent?.active}`);

    // 3. Verify Criteria in Database
    console.log("\n3. Verifying Criteria association in Database...");
    const critRows = await sql`
      SELECT id, name, "maxScore", weight, "orderIndex", active, "eventId"
      FROM "Criteria"
      WHERE "eventId" = ${createdId}
      ORDER BY "orderIndex" ASC;
    `;
    assert("Event has exactly 4 isolated criteria created atomically", critRows.length === 4, `Found ${critRows.length} criteria`);
    for (const c of critRows) {
      assert(`Criterion [${c.id}] has correct eventId`, c.eventId === createdId, `Criterion eventId: ${c.eventId}`);
      assert(`Criterion [${c.id}] active=true`, c.active === true);
    }

    // 4. Verify Admin view (getEvents)
    console.log("\n4. Verifying Admin view (getEvents)...");
    const allEvents = await getEvents();
    const inEventsList = allEvents.some(e => e.id === createdId);
    assert("Admin getEvents() includes the newly created event", inEventsList, `Total events: ${allEvents.length}`);

    // 5. Verify getConfig pure read
    console.log("\n5. Verifying getConfig purity for created event...");
    const config = await getConfig(createdId);
    assert("getConfig(eventId) returns the criteria", config.criteriaList.length === 4, `Criteria count: ${config.criteriaList.length}`);

    // Check count didn't increase
    const critCountAfter = await sql`SELECT count(*)::int as count FROM "Criteria" WHERE "eventId" = ${createdId};`;
    assert("getConfig read did not insert duplicate criteria", critCountAfter[0].count === 4, `Count: ${critCountAfter[0].count}`);

    // 6. Verify Multi-Event Isolation for Judge
    console.log("\n6. Verifying Judge Authorization & Event Isolation...");
    const judges = await sql`SELECT id, "eventId" FROM "User" WHERE role = 'judge' LIMIT 1;`;
    if (judges.length > 0) {
      const judgeId = judges[0].id;
      const judgePortal = await getJudgePortalData(judgeId, createdId);
      assert("getJudgePortalData call succeeds", judgePortal.success === true);
      // Because judge is not authorized for new unassigned event, security clamps to authorized event
      assert("Judge cannot access unassigned event (clamped to authorized)", judgePortal.data?.selectedEventId !== createdId, `Clamped to: ${judgePortal.data?.selectedEventId}`);
    }

    // 7. Cleanup using deleteEvent
    console.log("\n7. Deleting event via deleteEvent()...");
    const delRes = await deleteEvent(createdId);
    assert("deleteEvent succeeds with success=true", delRes.success === true);

    // 8. Verify complete database cleanup
    console.log("\n8. Verifying complete database cleanup...");
    const remainingEvent = await sql`SELECT count(*)::int as count FROM "Event" WHERE id = ${createdId};`;
    assert("Event record removed", remainingEvent[0].count === 0);

    const remainingCrit = await sql`SELECT count(*)::int as count FROM "Criteria" WHERE "eventId" = ${createdId};`;
    assert("All associated criteria removed (0 orphans)", remainingCrit[0].count === 0);

    const remainingAudit = await sql`SELECT count(*)::int as count FROM "AuditLog" WHERE "eventId" = ${createdId};`;
    assert("Event audit records cleaned up", remainingAudit[0].count === 0);

    console.log("\n==================================================");
    console.log(`✅ ALL ${results.length} CREATE EVENT ACCEPTANCE CHECKS PASSED!`);
    console.log("==================================================");
  } catch (err) {
    console.error("Test failed with error:", err);
    if (createdId) {
      console.log("Emergency cleanup of created test event:", createdId);
      await sql`DELETE FROM "Criteria" WHERE "eventId" = ${createdId};`;
      await sql`DELETE FROM "AuditLog" WHERE "eventId" = ${createdId};`;
      await sql`DELETE FROM "Event" WHERE id = ${createdId};`;
    }
    process.exit(1);
  }
}

run();
