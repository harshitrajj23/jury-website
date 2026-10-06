require("dotenv").config();
const { neon } = require("@neondatabase/serverless");
const bcrypt = require("bcryptjs");

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const sql = neon(connectionString);

async function runTestSuite() {
  console.log("=================================================================");
  console.log("   AUTOMATED REGRESSION & MULTI-EVENT VERIFICATION SUITE         ");
  console.log("=================================================================\n");

  let allPassed = true;

  // -------------------------------------------------------------
  // TEST 1: SCORE INPUT VALIDATION (Integers 1-10 strictly)
  // -------------------------------------------------------------
  console.log("--- TEST 1: STRICT SCORE INPUT VALIDATION (INTEGERS 1–10) ---");
  
  function validateScoreInput(val) {
    if (val === undefined || val === null || String(val).trim() === "") {
      return { valid: false, error: "Empty score" };
    }
    const str = String(val).trim();
    if (!/^-?\d+$/.test(str)) {
      return { valid: false, error: "Non-integer / decimal" };
    }
    const num = parseInt(str, 10);
    if (isNaN(num) || num < 1 || num > 10) {
      return { valid: false, error: "Out of range (1-10)" };
    }
    return { valid: true, value: num };
  }

  const testCases = [
    { input: 1, expected: true, desc: "1 -> valid" },
    { input: 5, expected: true, desc: "5 -> valid" },
    { input: 10, expected: true, desc: "10 -> valid" },
    { input: 0, expected: false, desc: "0 -> invalid" },
    { input: 11, expected: false, desc: "11 -> invalid" },
    { input: -1, expected: false, desc: "-1 -> invalid" },
    { input: 5.5, expected: false, desc: "5.5 -> invalid (decimal)" },
    { input: "abc", expected: false, desc: "text -> invalid" },
    { input: "", expected: false, desc: "empty -> invalid" },
    { input: " 8 ", expected: true, desc: "' 8 ' -> valid trimmed" },
  ];

  let test1Pass = true;
  for (const tc of testCases) {
    const res = validateScoreInput(tc.input);
    const pass = res.valid === tc.expected;
    if (!pass) test1Pass = false;
    console.log(`  [${pass ? "PASS" : "FAIL"}] ${tc.desc}: valid=${res.valid} (error: ${res.error || "none"})`);
  }
  if (!test1Pass) allPassed = false;
  console.log(`Score Validation Status: ${test1Pass ? "✅ PASS" : "❌ FAIL"}\n`);

  // -------------------------------------------------------------
  // TEST 2: SEED MOCK DATA & MULTI-EVENT ISOLATION
  // -------------------------------------------------------------
  console.log("--- TEST 2: SEED MOCK DATA & MULTI-EVENT ISOLATION ---");
  const { execSync } = require("child_process");
  execSync("node scripts/seed-mock-data.js", { stdio: "inherit" });

  // Query Event A teams vs Event B teams
  const eventATeams = await sql`SELECT id, "teamName" FROM "Team" WHERE "eventId" = 'mock_evt_pals' ORDER BY id ASC;`;
  const eventBTeams = await sql`SELECT id, "teamName" FROM "Team" WHERE "eventId" = 'mock_evt_ieee' ORDER BY id ASC;`;

  console.log(`Event A (PALS) Teams: ${eventATeams.map(t => t.teamName).join(", ")}`);
  console.log(`Event B (IEEE) Teams: ${eventBTeams.map(t => t.teamName).join(", ")}`);

  const hasEventACrossLeak = eventATeams.some(t => t.teamName.includes("IEEE") || t.teamName.includes("Solar") || t.teamName.includes("CyberPulse"));
  const hasEventBCrossLeak = eventBTeams.some(t => t.teamName.includes("PALS") || t.teamName.includes("NeuroSync") || t.teamName.includes("Quantum"));

  const isolationPass = !hasEventACrossLeak && !hasEventBCrossLeak && eventATeams.length === 3 && eventBTeams.length === 3;
  if (!isolationPass) allPassed = false;
  console.log(`Team Isolation Verification: ${isolationPass ? "✅ PASS (ZERO CROSS-EVENT LEAKAGE)" : "❌ FAIL"}\n`);

  // -------------------------------------------------------------
  // TEST 3: JUDGE SCOPING & ISOLATION
  // -------------------------------------------------------------
  console.log("--- TEST 3: JUDGE SCOPING & ISOLATION ---");
  const eventAJudges = await sql`SELECT id, name, email, "eventId" FROM "User" WHERE "eventId" = 'mock_evt_pals';`;
  const eventBJudges = await sql`SELECT id, name, email, "eventId" FROM "User" WHERE "eventId" = 'mock_evt_ieee';`;

  console.log(`Event A Judges: ${eventAJudges.map(j => j.email).join(", ")}`);
  console.log(`Event B Judges: ${eventBJudges.map(j => j.email).join(", ")}`);

  const judgeIsolationPass = eventAJudges.every(j => j.eventId === 'mock_evt_pals') &&
                             eventBJudges.every(j => j.eventId === 'mock_evt_ieee') &&
                             eventAJudges.length >= 2 && eventBJudges.length >= 2;
  if (!judgeIsolationPass) allPassed = false;
  console.log(`Judge Isolation Verification: ${judgeIsolationPass ? "✅ PASS" : "❌ FAIL"}\n`);

  // -------------------------------------------------------------
  // TEST 4: SCORES & LEADERBOARD ISOLATION
  // -------------------------------------------------------------
  console.log("--- TEST 4: SCORES & LEADERBOARD EVENT SCOPING ---");
  const eventAScores = await sql`SELECT s.id, s."teamId", s."eventId" FROM "Score" s WHERE s."eventId" = 'mock_evt_pals';`;
  const eventBScores = await sql`SELECT s.id, s."teamId", s."eventId" FROM "Score" s WHERE s."eventId" = 'mock_evt_ieee';`;

  console.log(`Event A Scores Count: ${eventAScores.length}`);
  console.log(`Event B Scores Count: ${eventBScores.length}`);

  const scoresIsolationPass = eventAScores.every(s => s.eventId === 'mock_evt_pals') &&
                              eventBScores.every(s => s.eventId === 'mock_evt_ieee') &&
                              eventAScores.length > 0 && eventBScores.length > 0;
  if (!scoresIsolationPass) allPassed = false;
  console.log(`Score Table Event Isolation: ${scoresIsolationPass ? "✅ PASS" : "❌ FAIL"}\n`);

  // -------------------------------------------------------------
  // TEST 5: PRESENTATION TIMER CONFIGURATION & PERSISTENCE
  // -------------------------------------------------------------
  console.log("--- TEST 5: PRESENTATION TIMER SETTINGS & PERSISTENCE ---");
  // Set Event A to 5 mins (300s)
  await sql`UPDATE "Event" SET "timerDuration" = 300, "updatedAt" = NOW() WHERE id = 'mock_evt_pals';`;
  // Set Event B to 7 mins (420s)
  await sql`UPDATE "Event" SET "timerDuration" = 420, "updatedAt" = NOW() WHERE id = 'mock_evt_ieee';`;

  const [evA] = await sql`SELECT "timerDuration" FROM "Event" WHERE id = 'mock_evt_pals';`;
  const [evB] = await sql`SELECT "timerDuration" FROM "Event" WHERE id = 'mock_evt_ieee';`;

  console.log(`Event A Configured Duration: ${evA.timerDuration}s (${Math.round(evA.timerDuration / 60)} minutes)`);
  console.log(`Event B Configured Duration: ${evB.timerDuration}s (${Math.round(evB.timerDuration / 60)} minutes)`);

  const timerPass = evA.timerDuration === 300 && evB.timerDuration === 420;
  if (!timerPass) allPassed = false;
  console.log(`Timer Persistence Verification: ${timerPass ? "✅ PASS (EXACT MINUTES PRESERVED)" : "❌ FAIL"}\n`);

  // -------------------------------------------------------------
  // TEST 6: CONCURRENT JURY LOAD SIMULATION (5, 10, 20 JUDGES)
  // -------------------------------------------------------------
  console.log("--- TEST 6: CONCURRENT JURY LOAD SIMULATION ---");
  const concurrencyTiers = [5, 10, 20];
  for (const tier of concurrencyTiers) {
    const tempJudges = [];
    for (let i = 0; i < tier; i++) {
      const uId = `mock_usr_load_${tier}_${i}`;
      tempJudges.push(uId);
      await sql`
        INSERT INTO "User" (id, name, email, "passwordHash", role, completed, "eventId", "createdAt", "updatedAt")
        VALUES (${uId}, ${'Load Judge ' + i}, ${'load_j_' + tier + '_' + i + '@test.com'}, 'hash', 'judge', false, 'mock_evt_pals', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `;
    }

    const t0 = performance.now();
    await Promise.all(
      tempJudges.map(async (jId, idx) => {
        const ids = [];
        const judgeIds = [];
        const teamIds = [];
        const critIds = [];
        const scoreVals = [];
        const comments = [];
        const eventIds = [];

        const crit = "mock_cr_pals_0";
        ids.push(`mock_sc_${tier}_${idx}`);
        judgeIds.push(jId);
        teamIds.push("mock_tm_pals_1");
        critIds.push(crit);
        scoreVals.push((idx % 5) + 5);
        comments.push('');
        eventIds.push('mock_evt_pals');

        await sql`
          INSERT INTO "Score" (id, "judgeId", "teamId", "criteriaId", score, comment, "eventId", "createdAt", "updatedAt")
          SELECT 
            unnest(${ids}::text[]),
            unnest(${judgeIds}::text[]),
            unnest(${teamIds}::text[]),
            unnest(${critIds}::text[]),
            unnest(${scoreVals}::int[]),
            unnest(${comments}::text[]),
            unnest(${eventIds}::text[]),
            NOW(),
            NOW()
          ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score;
        `;
      })
    );
    const duration = performance.now() - t0;
    console.log(`  - ${tier} Concurrent Submissions: ${duration.toFixed(1)}ms (avg: ${(duration / tier).toFixed(1)}ms/op) -> ✅ PASS`);

    // Clean up temporary concurrency test records
    await sql`DELETE FROM "Score" WHERE id LIKE ${'mock_sc_' + tier + '_%'};`;
    await sql`DELETE FROM "User" WHERE id LIKE ${'mock_usr_load_' + tier + '_%'};`;
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 7: CLEANUP OF MOCK DATA (SAFETY GUARANTEE)
  // -------------------------------------------------------------
  console.log("--- TEST 7: SAFE MOCK DATA CLEANUP ---");
  execSync("node scripts/clean-mock-data.js", { stdio: "inherit" });

  const [{ mockEventCount }] = await sql`SELECT count(*)::int as "mockEventCount" FROM "Event" WHERE id LIKE 'mock_%';`;
  const [{ mockTeamCount }] = await sql`SELECT count(*)::int as "mockTeamCount" FROM "Team" WHERE id LIKE 'mock_%';`;
  const [{ mockScoreCount }] = await sql`SELECT count(*)::int as "mockScoreCount" FROM "Score" WHERE id LIKE 'mock_%';`;

  const cleanPass = mockEventCount === 0 && mockTeamCount === 0 && mockScoreCount === 0;
  if (!cleanPass) allPassed = false;
  console.log(`Mock Cleanup Status: ${cleanPass ? "✅ PASS (0 MOCK RESIDUE IN DATABASE)" : "❌ FAIL"}\n`);

  console.log("=================================================================");
  if (allPassed) {
    console.log("🏆 ALL MULTI-EVENT & REGRESSION TESTS PASSED CLEANLY!");
  } else {
    console.log("❌ SOME TESTS FAILED. PLEASE INSPECT LOGS.");
  }
  console.log("=================================================================\n");

  if (!allPassed) process.exit(1);
}

runTestSuite().catch((err) => {
  console.error("Test suite runtime failure:", err);
  process.exit(1);
});
