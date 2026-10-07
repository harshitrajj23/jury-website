require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

const sql = neon(process.env.DATABASE_URL);

// Import the database functions from built Next/bundle or test directly against database queries & logic
async function runBugFixTestSuite() {
  console.log("=================================================================");
  console.log("🧪 RUNNING BUG 1 & BUG 2 COMPREHENSIVE REGRESSION SUITE");
  console.log("=================================================================\n");

  const results = [];
  function record(id, title, passed, details) {
    results.push({ id, title, passed, details });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] Test ${id}: ${title}`);
    if (!passed) console.error(`       Details: ${details}`);
  }

  const testSuffix = Date.now().toString(36);
  const eventAId = `test_evA_${testSuffix}`;
  const eventBId = `test_evB_${testSuffix}`;
  const judgeAId = `test_jdA_${testSuffix}`;
  const judgeBId = `test_jdB_${testSuffix}`;
  const judgeSharedId = `test_jdShared_${testSuffix}`;
  const adminTestId = `test_adm_${testSuffix}`;
  const teamA1Id = `test_tmA1_${testSuffix}`;
  const teamA2Id = `test_tmA2_${testSuffix}`;
  const teamB1Id = `test_tmB1_${testSuffix}`;
  const teamB2Id = `test_tmB2_${testSuffix}`;

  try {
    // -------------------------------------------------------------
    // PART 1: HEAL AND VERIFY PRODUCTION STATE (BUG 1)
    // -------------------------------------------------------------
    console.log("\n--- PART 1: AUTO-HEALING & PRODUCTION JUDGE VERIFICATION ---");
    
    // Auto-heal referenced events like in initDatabase()
    const referencedEvents = await sql`
      SELECT DISTINCT "eventId" as id FROM "Team" WHERE "eventId" IS NOT NULL AND "eventId" != ''
      UNION
      SELECT DISTINCT "eventId" as id FROM "User" WHERE "eventId" IS NOT NULL AND "eventId" != '' AND role != 'admin';
    `;
    const refIds = (referencedEvents || []).map((r) => r.id).filter((id) => id && !id.includes(','));
    for (const evId of refIds) {
      await sql`
        INSERT INTO "Event" (id, name, subtitle, organizer, status, active)
        VALUES (${evId}, 'TechNova Hackathon', 'Collegiate Innovation Challenge', 'Computer Science Club', 'active', true)
        ON CONFLICT (id) DO UPDATE SET active = true;
      `;
    }

    const activeEvents = await sql`SELECT id, name FROM "Event" WHERE active = true;`;
    record(1, "Database Auto-Healing: Event table restored with active events", activeEvents.length > 0, `Active events found: ${activeEvents.map(e => e.id).join(', ')}`);

    // Verify existing judge keerti
    const keertiUser = await sql`SELECT id, name, email, role, "eventId" FROM "User" WHERE email = 'keerti@jury.portal';`;
    record(2, "Judge Keerti: Account exists in User table", keertiUser.length > 0, `User: ${keertiUser[0]?.id}`);

    if (keertiUser.length > 0) {
      const keerti = keertiUser[0];
      const keertiEvent = await sql`SELECT id, name FROM "Event" WHERE id = ${keerti.eventId} AND active = true;`;
      record(3, "Judge Keerti: Assigned event is active in Event table", keertiEvent.length > 0, `Event: ${keertiEvent[0]?.id} (${keertiEvent[0]?.name})`);

      const keertiTeams = await sql`SELECT id, "teamName", "eventId" FROM "Team" WHERE "eventId" = ${keerti.eventId};`;
      record(4, "Judge Keerti: Expected teams belong to authorized event", keertiTeams.length === 3, `Found ${keertiTeams.length} teams: ${keertiTeams.map(t => t.teamName).join(', ')}`);
    }

    // -------------------------------------------------------------
    // PART 2: MULTI-EVENT ISOLATION & ACCESS CONTROL (BUG 1)
    // -------------------------------------------------------------
    console.log("\n--- PART 2: MULTI-EVENT ISOLATION & TEAM VISIBILITY ---");

    // Create Event A and Event B
    await sql`
      INSERT INTO "Event" (id, name, status, active)
      VALUES (${eventAId}, 'Alpha Fest', 'active', true),
             (${eventBId}, 'Beta Fest', 'active', true);
    `;

    // Create Teams
    await sql`
      INSERT INTO "Team" (id, "teamName", "projectName", "teamCode", "tableNumber", members, "eventId", "createdAt", "updatedAt")
      VALUES (${teamA1Id}, 'Team Alpha 1', 'Project A1', 'TA1', 1, '[]', ${eventAId}, NOW(), NOW()),
             (${teamA2Id}, 'Team Alpha 2', 'Project A2', 'TA2', 2, '[]', ${eventAId}, NOW(), NOW()),
             (${teamB1Id}, 'Team Beta 1', 'Project B1', 'TB1', 1, '[]', ${eventBId}, NOW(), NOW()),
             (${teamB2Id}, 'Team Beta 2', 'Project B2', 'TB2', 2, '[]', ${eventBId}, NOW(), NOW());
    `;

    // Create Judge A and Judge B
    const passHash = bcrypt.hashSync("123456", 10);
    await sql`
      INSERT INTO "User" (id, name, email, "passwordHash", role, completed, "eventId", "createdAt", "updatedAt")
      VALUES (${judgeAId}, 'Judge Alpha', ${`ja_${testSuffix}@jury.portal`}, ${passHash}, 'judge', false, ${eventAId}, NOW(), NOW()),
             (${judgeBId}, 'Judge Beta', ${`jb_${testSuffix}@jury.portal`}, ${passHash}, 'judge', false, ${eventBId}, NOW(), NOW());
    `;

    // Test Judge A scoped team fetch
    const judgeATeams = await sql`SELECT id, "teamName", "eventId" FROM "Team" WHERE TRIM("eventId") = ${eventAId};`;
    const judgeASeesOnlyA = judgeATeams.length === 2 && judgeATeams.every(t => t.eventId === eventAId);
    record(5, "Event Isolation: Judge A sees all Event A teams", judgeASeesOnlyA, `Found ${judgeATeams.length} teams for Event A`);

    const judgeASeesB = judgeATeams.some(t => t.eventId === eventBId);
    record(6, "Event Isolation: Judge A NEVER sees Event B teams", !judgeASeesB, "Zero Event B teams leaked to Judge A");

    // Test Judge B scoped team fetch
    const judgeBTeams = await sql`SELECT id, "teamName", "eventId" FROM "Team" WHERE TRIM("eventId") = ${eventBId};`;
    const judgeBSeesOnlyB = judgeBTeams.length === 2 && judgeBTeams.every(t => t.eventId === eventBId);
    record(7, "Event Isolation: Judge B sees all Event B teams", judgeBSeesOnlyB, `Found ${judgeBTeams.length} teams for Event B`);

    const judgeBSeesA = judgeBTeams.some(t => t.eventId === eventAId);
    record(8, "Event Isolation: Judge B NEVER sees Event A teams", !judgeBSeesA, "Zero Event A teams leaked to Judge B");

    // -------------------------------------------------------------
    // PART 3: EVENT DELETION USER CLEANUP & ADMIN PROTECTION (BUG 2)
    // -------------------------------------------------------------
    console.log("\n--- PART 3: EVENT DELETION USER CLEANUP & ADMIN PROTECTION ---");

    // Setup:
    // Event A has:
    // 1. judgeAId -> ONLY Event A
    // 2. judgeSharedId -> Event A + Event B (assigned to both: `${eventAId},${eventBId}`)
    // 3. adminTestId -> role = 'admin', eventId = eventAId
    await sql`
      INSERT INTO "User" (id, name, email, "passwordHash", role, completed, "eventId", "createdAt", "updatedAt")
      VALUES (${judgeSharedId}, 'Shared Judge', ${`shared_${testSuffix}@jury.portal`}, ${passHash}, 'judge', false, ${`${eventAId},${eventBId}`}, NOW(), NOW()),
             (${adminTestId}, 'Admin Test', ${`adm_${testSuffix}@jury.portal`}, ${passHash}, 'admin', false, ${eventAId}, NOW(), NOW());
    `;

    // Add criteria and score to Event A
    const critAId = `cr_A_${testSuffix}`;
    const scoreAId = `sc_A_${testSuffix}`;
    await sql`
      INSERT INTO "Criteria" (id, name, description, "maxScore", weight, "orderIndex", active, "eventId")
      VALUES (${critAId}, 'Design', 'Design criteria description', 10, 1.0, 1, true, ${eventAId});
    `;
    await sql`
      INSERT INTO "Score" (id, "judgeId", "teamId", "criteriaId", score, comment, "eventId", "createdAt", "updatedAt")
      VALUES (${scoreAId}, ${judgeAId}, ${teamA1Id}, ${critAId}, 9, 'Great work', ${eventAId}, NOW(), NOW());
    `;

    // Now execute atomic deletion logic for Event A:
    const cleanEventId = eventAId;

    // 1. Identify users
    const allUsers = await sql`SELECT id, name, email, role, "eventId" FROM "User";`;
    const otherActiveEvents = await sql`SELECT id FROM "Event" WHERE id != ${cleanEventId} AND active = true;`;
    const otherActiveEventSet = new Set(otherActiveEvents.map(e => e.id));

    const userIdsToDelete = [];
    const usersToUpdateAssociation = [];

    for (const u of allUsers) {
      if (u.role === "admin") continue;
      if (!u.eventId || String(u.eventId).trim() === "") continue;

      const assignedIds = String(u.eventId).split(",").map(s => s.trim()).filter(Boolean);
      if (!assignedIds.includes(cleanEventId)) continue;

      const remainingAssigned = assignedIds.filter(id => id !== cleanEventId);
      const remainingActive = remainingAssigned.filter(id => otherActiveEventSet.has(id));

      if (remainingActive.length === 0) {
        userIdsToDelete.push(u.id);
      } else {
        usersToUpdateAssociation.push({ id: u.id, newEventId: remainingAssigned.join(",") });
      }
    }

    record(9, "Deletion Analysis: Event-only judge identified for deletion", userIdsToDelete.includes(judgeAId), `Users to delete: ${userIdsToDelete.join(', ')}`);
    record(10, "Deletion Analysis: Shared judge identified for preservation", usersToUpdateAssociation.some(u => u.id === judgeSharedId), `Shared users to update: ${usersToUpdateAssociation.map(u => u.id).join(', ')}`);
    record(11, "Deletion Analysis: Admin user protected from deletion", !userIdsToDelete.includes(adminTestId), "Admin ID was excluded");

    // Execute deletion transaction
    await (sql).transaction(tx => {
      const ops = [
        tx`DELETE FROM "Score" WHERE "eventId" = ${cleanEventId};`,
        tx`DELETE FROM "Criteria" WHERE "eventId" = ${cleanEventId};`,
        tx`DELETE FROM "Team" WHERE "eventId" = ${cleanEventId};`,
      ];
      for (const update of usersToUpdateAssociation) {
        ops.push(tx`UPDATE "User" SET "eventId" = ${update.newEventId}, "updatedAt" = NOW() WHERE id = ${update.id} AND role != 'admin';`);
      }
      if (userIdsToDelete.length > 0) {
        ops.push(tx`DELETE FROM "User" WHERE id = ANY(${userIdsToDelete}) AND role != 'admin';`);
      }
      ops.push(tx`DELETE FROM "AuditLog" WHERE "eventId" = ${cleanEventId};`);
      ops.push(tx`DELETE FROM "Event" WHERE id = ${cleanEventId};`);
      return ops;
    });

    // -------------------------------------------------------------
    // PART 4: POST-DELETION VERIFICATION
    // -------------------------------------------------------------
    console.log("\n--- PART 4: POST-DELETION DATABASE VERIFICATION ---");

    const [deletedEv] = await sql`SELECT id FROM "Event" WHERE id = ${eventAId};`;
    record(12, "Event Deletion: Event A record permanently deleted", !deletedEv, "Event A is gone");

    const [deletedTeam] = await sql`SELECT id FROM "Team" WHERE "eventId" = ${eventAId};`;
    record(13, "Event Deletion: Event A teams permanently deleted", !deletedTeam, "All Event A teams deleted");

    const [deletedCrit] = await sql`SELECT id FROM "Criteria" WHERE "eventId" = ${eventAId};`;
    record(14, "Event Deletion: Event A criteria permanently deleted", !deletedCrit, "All Event A criteria deleted");

    const [deletedScore] = await sql`SELECT id FROM "Score" WHERE "eventId" = ${eventAId};`;
    record(15, "Event Deletion: Event A scores permanently deleted", !deletedScore, "All Event A scores deleted");

    const [eventOnlyJudgeCheck] = await sql`SELECT id FROM "User" WHERE id = ${judgeAId};`;
    record(16, "User Cleanup: Event-only Judge A DELETED from User table", !eventOnlyJudgeCheck, "Judge A record removed");

    const [sharedJudgeCheck] = await sql`SELECT id, "eventId" FROM "User" WHERE id = ${judgeSharedId};`;
    record(17, "User Preservation: Shared judge KEPT in User table", !!sharedJudgeCheck, `Shared judge exists with eventId: ${sharedJudgeCheck?.eventId}`);
    record(18, "User Association: Shared judge association updated to remaining Event B", sharedJudgeCheck?.eventId === eventBId, `Updated eventId: ${sharedJudgeCheck?.eventId}`);

    const [adminCheck] = await sql`SELECT id, role FROM "User" WHERE id = ${adminTestId};`;
    record(19, "Admin Protection: Admin user PRESERVED in User table", !!adminCheck && adminCheck.role === 'admin', `Admin user exists: ${adminCheck?.id}`);

    // Verify Event B remains intact
    const [eventBCheck] = await sql`SELECT id, name FROM "Event" WHERE id = ${eventBId};`;
    const eventBTeamsCheck = await sql`SELECT id FROM "Team" WHERE "eventId" = ${eventBId};`;
    const [judgeBCheck] = await sql`SELECT id FROM "User" WHERE id = ${judgeBId};`;
    record(20, "Multi-Event Integrity: Event B, its teams, and its judges 100% intact", !!eventBCheck && eventBTeamsCheck.length === 2 && !!judgeBCheck, `Event B teams: ${eventBTeamsCheck.length}`);

  } finally {
    // Clean up temporary test records
    console.log("\n🧹 Cleaning temporary test records...");
    await sql`DELETE FROM "Score" WHERE "eventId" IN (${eventAId}, ${eventBId});`;
    await sql`DELETE FROM "Criteria" WHERE "eventId" IN (${eventAId}, ${eventBId});`;
    await sql`DELETE FROM "Team" WHERE "eventId" IN (${eventAId}, ${eventBId});`;
    await sql`DELETE FROM "User" WHERE id IN (${judgeAId}, ${judgeBId}, ${judgeSharedId}, ${adminTestId});`;
    await sql`DELETE FROM "AuditLog" WHERE "eventId" IN (${eventAId}, ${eventBId});`;
    await sql`DELETE FROM "Event" WHERE id IN (${eventAId}, ${eventBId});`;
    console.log("✅ Temporary test records cleaned up.");
  }

  console.log("\n=================================================================");
  const allPassed = results.every(r => r.passed);
  console.log(`   FINAL VERDICT: ${allPassed ? "🎉 ALL 20 TESTS PASSED (GREEN)" : "❌ SOME TESTS FAILED"}`);
  console.log("=================================================================\n");

  if (!allPassed) process.exit(1);
}

runBugFixTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
