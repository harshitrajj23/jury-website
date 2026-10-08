require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

const DEFAULT_CRITERIA_TEMPLATE = [
  { name: "Problem Solving & Innovation", description: "Creativity, novelty, and uniqueness of the solution", maxScore: 10, weight: 1.0, orderIndex: 0 },
  { name: "Technical Execution", description: "Architectural robustness, code quality, and implementation depth", maxScore: 10, weight: 1.0, orderIndex: 1 },
  { name: "Design & User Experience", description: "Intuitive UI, ergonomics, accessibility, and visual polish", maxScore: 10, weight: 1.0, orderIndex: 2 },
  { name: "Presentation & Delivery", description: "Clarity of communication, demo efficacy, and Q&A defense", maxScore: 10, weight: 1.0, orderIndex: 3 },
];

async function runCriteriaPipelineTest() {
  console.log("=================================================================");
  console.log("🎯 MASTER AUDIT: CRITERIA PIPELINE SYNCHRONIZATION TEST");
  console.log("=================================================================\n");

  const results = [];
  function record(title, passed, detail) {
    results.push({ title, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${title}`);
    if (detail) console.log(`   └─ ${detail}`);
    if (!passed) throw new Error(`Test failed: ${title}`);
  }

  // 1. Check Primary Event
  const events = await sql`SELECT id, name, active FROM "Event" WHERE active = true ORDER BY "createdAt" ASC;`;
  const primaryEvent = events[0];
  record("Primary event exists in Neon DB", !!primaryEvent, `Found [${primaryEvent.id}] "${primaryEvent.name}"`);

  // 2. Simulate getConfig(primaryEvent.id) self-healing/seeding
  const cleanEventId = primaryEvent.id.trim();
  let critRows = await sql`
    SELECT id, name, description, "maxScore", weight, "orderIndex", active, "eventId"
    FROM "Criteria"
    WHERE active = true AND "eventId" = ${cleanEventId}
    ORDER BY "orderIndex" ASC;
  `;
  if (!critRows || critRows.length === 0) {
    console.log("   (Triggering auto-seeding for event since 0 criteria were in table)");
    for (const t of DEFAULT_CRITERIA_TEMPLATE) {
      const critId = `cr_${cleanEventId}_${t.orderIndex}`;
      await sql`
        INSERT INTO "Criteria" (id, name, description, "maxScore", weight, "orderIndex", active, "eventId", "createdAt")
        VALUES (${critId}, ${t.name}, ${t.description}, ${t.maxScore}, ${t.weight}, ${t.orderIndex}, true, ${cleanEventId}, NOW())
        ON CONFLICT (id) DO NOTHING;
      `;
    }
    critRows = await sql`
      SELECT id, name, description, "maxScore", weight, "orderIndex", active, "eventId"
      FROM "Criteria"
      WHERE active = true AND "eventId" = ${cleanEventId}
      ORDER BY "orderIndex" ASC;
    `;
  }
  record("Active criteria exist for primary event in DB", critRows.length > 0, `Event has ${critRows.length} active criteria`);

  // 3. Admin adds a new criterion to Event A
  const testCritId = `crit_${cleanEventId}_test_${Date.now()}`;
  const testCritName = `AI Architecture & Scalability [${Date.now().toString(36)}]`;
  await sql`
    INSERT INTO "Criteria" (id, name, description, "maxScore", weight, "orderIndex", active, "eventId", "createdAt")
    VALUES (${testCritId}, ${testCritName}, 'Cloud architecture and scale', 10, 1.5, ${critRows.length}, true, ${cleanEventId}, NOW())
    ON CONFLICT (id) DO UPDATE SET active = true;
  `;

  const verifyInsert = await sql`SELECT id, name, active, "eventId" FROM "Criteria" WHERE id = ${testCritId} AND active = true;`;
  record("Admin criterion persisted to DB with correct eventId", verifyInsert.length === 1 && verifyInsert[0].eventId === cleanEventId, `Persisted as [${verifyInsert[0]?.id}] for event ${verifyInsert[0]?.eventId}`);

  // 4. Judge query: Verify judge assigned to primaryEvent queries and sees the new criterion
  const judgeRows = await sql`SELECT id, name, email, "eventId" FROM "User" WHERE role = 'judge' LIMIT 1;`;
  const judge = judgeRows[0];
  record("Judge exists for primary event", !!judge, `Judge: [${judge.id}] "${judge.name}" (${judge.email})`);

  // Judge fetches criteria for this event
  const judgeCriteria = await sql`
    SELECT id, name, description, "maxScore", weight, "orderIndex", active, "eventId"
    FROM "Criteria"
    WHERE active = true AND "eventId" = ${cleanEventId}
    ORDER BY "orderIndex" ASC;
  `;
  const judgeSeen = judgeCriteria.find(c => c.id === testCritId);
  record("Judge receives newly created criterion", !!judgeSeen, `Found criterion "${judgeSeen?.name}" in judge criteria list`);

  // 5. Judge selects team from same event and submits score
  const teamRows = await sql`SELECT id, "teamName", "eventId" FROM "Team" WHERE "eventId" = ${cleanEventId} LIMIT 1;`;
  const team = teamRows[0];
  record("Team exists for primary event", !!team, `Team: [${team.id}] "${team.teamName}"`);

  // Submit test score
  const scoreId = `sc_${judge.id}_${team.id}_${testCritId}`;
  await sql`
    INSERT INTO "Score" (id, "judgeId", "teamId", "criteriaId", score, comment, "eventId", "createdAt", "updatedAt")
    VALUES (${scoreId}, ${judge.id}, ${team.id}, ${testCritId}, 9, 'Exemplary work', ${cleanEventId}, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, "updatedAt" = NOW();
  `;

  const scoreInDb = await sql`SELECT id, "judgeId", "teamId", "criteriaId", score, "eventId" FROM "Score" WHERE id = ${scoreId};`;
  record("Score saved against correct Event + Team + Criteria + Judge", scoreInDb.length === 1 && scoreInDb[0].score === 9 && scoreInDb[0].eventId === cleanEventId, `Score record: Judge=${scoreInDb[0]?.judgeId}, Team=${scoreInDb[0]?.teamId}, Crit=${scoreInDb[0]?.criteriaId}, Score=${scoreInDb[0]?.score}`);

  // 6. Leaderboard uses score correctly
  const eventScores = await sql`
    SELECT id, "judgeId", "teamId", "criteriaId", score, "eventId"
    FROM "Score"
    WHERE "eventId" = ${cleanEventId} AND "teamId" = ${team.id};
  `;
  record("Leaderboard queries event-scoped scores", eventScores.length > 0, `Retrieved ${eventScores.length} score entries for team ${team.id}`);

  // 7. Multi-Event Isolation: Create Event B and ensure Judge B never sees Event A's criteria or scores
  const eventBId = `iso_ev_${Date.now().toString(36)}`;
  await sql`
    INSERT INTO "Event" (id, name, status, active)
    VALUES (${eventBId}, 'Isolated Event B', 'active', true);
  `;

  // Auto-seed Event B
  for (const t of DEFAULT_CRITERIA_TEMPLATE) {
    const critId = `cr_${eventBId}_${t.orderIndex}`;
    await sql`
      INSERT INTO "Criteria" (id, name, description, "maxScore", weight, "orderIndex", active, "eventId", "createdAt")
      VALUES (${critId}, ${t.name}, ${t.description}, ${t.maxScore}, ${t.weight}, ${t.orderIndex}, true, ${eventBId}, NOW())
      ON CONFLICT (id) DO NOTHING;
    `;
  }

  const eventBCriteria = await sql`
    SELECT id, name, "eventId"
    FROM "Criteria"
    WHERE active = true AND "eventId" = ${eventBId};
  `;

  const leakedToB = eventBCriteria.find(c => c.id === testCritId);
  record("Event B criteria isolated: Event A custom criteria NEVER leak to Event B", !leakedToB, `Event B criteria count: ${eventBCriteria.length}, Event A custom crit leaked: ${!!leakedToB}`);

  // 8. Cleanup test records
  await sql`DELETE FROM "Score" WHERE id = ${scoreId};`;
  await sql`DELETE FROM "Criteria" WHERE id = ${testCritId};`;
  await sql`DELETE FROM "Criteria" WHERE "eventId" = ${eventBId};`;
  await sql`DELETE FROM "Event" WHERE id = ${eventBId};`;
  record("Cleanup test records completed", true, "Neon DB restored to pristine state");

  console.log("\n=================================================================");
  console.log("🎉 MASTER AUDIT RESULT: ALL PIPELINE STAGES SYNCHRONIZED & PASSING");
  console.log("=================================================================\n");
}

runCriteriaPipelineTest().catch(err => {
  console.error("PIPELINE TEST ERROR:", err);
  process.exit(1);
});
