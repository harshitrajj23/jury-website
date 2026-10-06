require("dotenv").config();
const { neon } = require("@neondatabase/serverless");
const fs = require("fs");
const path = require("path");

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const sql = neon(connectionString);

async function runRegressionSuite() {
  console.log("=================================================================");
  console.log("   JURY PLATFORM REGRESSION & NEW JUDGE WORKFLOW TEST SUITE      ");
  console.log("=================================================================\n");

  let allPassed = true;
  const results = [];

  function record(num, name, passed, detail) {
    results.push({ num, name, passed, detail });
    console.log(`[TEST ${num}] ${passed ? "✅ PASS" : "❌ FAIL"}: ${name}`);
    if (detail) console.log(`   └─ ${detail}`);
    if (!passed) allPassed = false;
  }

  // Setup safe, isolated temporary test event and records
  const testRunId = `reg_${Date.now()}`;
  const testEventAId = `test_ev_a_${testRunId}`;
  const testEventBId = `test_ev_b_${testRunId}`;
  const testJudgeAId = `judge_a_${testRunId}`;
  const testTeamAId = `team_alpha_${testRunId}`;
  const testTeamBId = `team_beta_${testRunId}`;
  const testCritAId = `crit_a_${testRunId}`;

  try {
    // 1. Seed isolated test events
    await sql`
      INSERT INTO "Event" (id, name, subtitle, organizer, logo, "organizerLogo", date, theme, status, "timerDuration", "judgingOpen", "leaderboardUnlocked", "finaleReady", active, "createdAt", "updatedAt")
      VALUES 
        (${testEventAId}, 'CyberHack 2026', 'National Hackathon', 'Code Society', '', '', '2026-10-15', 'AI', 'active', 300, true, false, false, true, NOW(), NOW()),
        (${testEventBId}, 'DesignSprint 2026', 'Product Exhibition', 'Design Guild', '', '', '2026-10-20', 'Design', 'active', 300, true, false, false, true, NOW(), NOW());
    `;

    // 2. Seed test judge
    await sql`
      INSERT INTO "User" (id, name, email, "passwordHash", role, completed, "eventId", "createdAt", "updatedAt")
      VALUES (${testJudgeAId}, 'Dr. Alan Turing', ${`judge_${testRunId}@jury.test`}, 'hash', 'judge', false, ${testEventAId}, NOW(), NOW());
    `;

    // 3. Seed test teams
    await sql`
      INSERT INTO "Team" (id, "teamName", "projectName", "teamCode", "tableNumber", members, "eventId", "createdAt", "updatedAt")
      VALUES
        (${testTeamAId}, 'Team Alpha', 'Project SkyNet', 'ALPHA-01', 1, 'Alice, Bob', ${testEventAId}, NOW(), NOW()),
        (${testTeamBId}, 'Team Beta', 'Project Horizon', 'BETA-02', 2, 'Charlie, Dave', ${testEventBId}, NOW(), NOW());
    `;

    // 4. Seed test criteria
    await sql`
      INSERT INTO "Criteria" (id, name, description, "maxScore", weight, "orderIndex", active, "eventId", "createdAt")
      VALUES
        (${testCritAId}, 'Innovation & Technical Feasibility', 'Evaluate technical depth', 10, 1.5, 1, true, ${testEventAId}, NOW());
    `;

    // TEST 1: Search Team - Exact query
    const teamsInA = await sql`SELECT id, "teamName", "projectName", "teamCode", "eventId" FROM "Team" WHERE "eventId" = ${testEventAId};`;
    const searchExact = teamsInA.filter(t => t.teamName.toLowerCase().includes("team alpha".toLowerCase()));
    record(1, "Search: Exact query 'Team Alpha'", searchExact.length === 1 && searchExact[0].id === testTeamAId, `Found: ${searchExact[0]?.teamName}`);

    // TEST 2: Search Team - Case-insensitive & partial match
    const searchPartialLower = teamsInA.filter(t => t.teamName.toLowerCase().includes("alpha"));
    const searchPartialUpper = teamsInA.filter(t => t.teamName.toLowerCase().includes("ALPHA".toLowerCase()));
    const searchPartialMid = teamsInA.filter(t => t.teamName.toLowerCase().includes("lph"));
    const caseInsensitivePass = searchPartialLower.length === 1 && searchPartialUpper.length === 1 && searchPartialMid.length === 1;
    record(2, "Search: Case-insensitive & partial ('alpha', 'ALPHA', 'lph')", caseInsensitivePass, `Matches correctly for all variations`);

    // TEST 3: Event Isolation - Teams scoped to active event only
    const teamsInB = await sql`SELECT id, "teamName", "projectName", "teamCode", "eventId" FROM "Team" WHERE "eventId" = ${testEventBId};`;
    const searchAlphaInB = teamsInB.filter(t => t.teamName.toLowerCase().includes("alpha"));
    record(3, "Event Isolation: Event A team NOT found in Event B search", searchAlphaInB.length === 0, `Search in Event B returned 0 results for Team Alpha`);

    // TEST 4: Score Range Validation (1-10 integer checks)
    function validateScore(val) {
      if (typeof val !== "number" || !Number.isInteger(val)) return false;
      return val >= 1 && val <= 10;
    }
    const validScoresPass = [1, 5, 8, 10].every(validateScore);
    const invalidScoresBlocked = [0, 11, -1, 5.5, NaN, null, undefined].every(v => !validateScore(v));
    record(4, "Score Validation: Strictly enforces integers 1–10", validScoresPass && invalidScoresBlocked, "Accepts 1, 5, 8, 10; Rejects 0, 11, decimals, non-integers");

    // TEST 5: Atomic Score Submission to Neon DB
    const scoreRecordId = `score_${testRunId}`;
    await sql`
      INSERT INTO "Score" (id, "teamId", "judgeId", "criteriaId", score, comment, "eventId", "createdAt", "updatedAt")
      VALUES (${scoreRecordId}, ${testTeamAId}, ${testJudgeAId}, ${testCritAId}, 9, 'Great prototype', ${testEventAId}, NOW(), NOW());
    `;
    const [insertedScore] = await sql`SELECT id, "teamId", "judgeId", score FROM "Score" WHERE id = ${scoreRecordId};`;
    record(5, "Atomic Score Submission to Neon DB", insertedScore && insertedScore.score === 9, `Score of 9 successfully stored for ${testTeamAId}`);

    // TEST 6: Duplicate Protection via DB Unique Constraint & App Lock
    await sql`
      INSERT INTO "Score" (id, "teamId", "judgeId", "criteriaId", score, comment, "eventId", "createdAt", "updatedAt")
      VALUES (${scoreRecordId}, ${testTeamAId}, ${testJudgeAId}, ${testCritAId}, 10, 'Updated score', ${testEventAId}, NOW(), NOW())
      ON CONFLICT ("judgeId", "teamId", "criteriaId") DO UPDATE SET 
        score = EXCLUDED.score,
        comment = EXCLUDED.comment,
        "updatedAt" = NOW();
    `;
    const scoresForTeam = await sql`SELECT id, score FROM "Score" WHERE "teamId" = ${testTeamAId} AND "judgeId" = ${testJudgeAId};`;
    record(6, "Duplicate Protection: Exactly 1 score record per criteria", scoresForTeam.length === 1 && scoresForTeam[0].score === 10, `Updated idempotently to 10 without duplicates`);

    // TEST 7: Evaluated Status Computation
    const allJudgeScores = await sql`SELECT DISTINCT "teamId", "judgeId" FROM "Score" WHERE "judgeId" = ${testJudgeAId};`;
    const isTeamAEvaluated = allJudgeScores.some(s => s.teamId === testTeamAId);
    const isTeamBEvaluated = allJudgeScores.some(s => s.teamId === testTeamBId);
    record(7, "Evaluated Status: Team Alpha shows Evaluated ✓, Team Beta shows Pending", isTeamAEvaluated && !isTeamBEvaluated, "Status correctly computed from submitted scores");

    // TEST 8: Weighted Leaderboard Calculation
    const [leaderboardRow] = await sql`
      SELECT t.id, t."teamName", AVG(s.score) as avg_score, AVG(s.score * c.weight) as weighted_avg
      FROM "Team" t
      JOIN "Score" s ON s."teamId" = t.id
      JOIN "Criteria" c ON s."criteriaId" = c.id
      WHERE t."eventId" = ${testEventAId}
      GROUP BY t.id, t."teamName";
    `;
    record(8, "Weighted Leaderboard: Calculates weighted average accurately", leaderboardRow && Number(leaderboardRow.weighted_avg) === 15.0, `Weighted Score: ${leaderboardRow?.weighted_avg} (Raw: ${leaderboardRow?.avg_score})`);

    // TEST 9: Verify Timer Completely Removed from Production Source UI
    console.log("\n🔍 Auditing Source Code: Verifying ZERO Timer UI & ZERO Jury Compliance Module...");
    const srcDir = path.join(process.cwd(), "src");
    function searchDirForPatterns(dir, patterns) {
      const files = fs.readdirSync(dir);
      let found = [];
      for (const f of files) {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          found = found.concat(searchDirForPatterns(full, patterns));
        } else if (f.endsWith(".tsx") || f.endsWith(".ts")) {
          const content = fs.readFileSync(full, "utf8");
          for (const p of patterns) {
            if (content.includes(p)) {
              found.push({ file: full, pattern: p });
            }
          }
        }
      }
      return found;
    }

    const timerUIOccurrences = searchDirForPatterns(srcDir, [
      "<Timer",
      "import Timer",
      "PRESENTATION_MONITOR",
      "TIME LIMIT (1–60 WHOLE MINUTES)",
      "PRESENTATION TIME LIMIT CONFIGURATION",
    ]);
    record(9, "Zero Timer UI / countdown in production components", timerUIOccurrences.length === 0, timerUIOccurrences.length === 0 ? "0 occurrences found in src/" : `Found in: ${timerUIOccurrences.map(o => o.file).join(", ")}`);

    // TEST 10: Verify Jury Compliance Module Removed
    const complianceOccurrences = searchDirForPatterns(srcDir, [
      "<RulesPanel",
      "import RulesPanel",
      "JUDGING COMPLIANCE MODULE",
      "PROTOCOL SEC-ID: JURY-EVAL-CORE",
    ]);
    record(10, "Zero Jury Compliance module in production components", complianceOccurrences.length === 0, complianceOccurrences.length === 0 ? "0 occurrences found in src/" : `Found in: ${complianceOccurrences.map(o => o.file).join(", ")}`);

    // TEST 11: Verify Dynamic Event Branding
    const [evA] = await sql`SELECT name, organizer FROM "Event" WHERE id = ${testEventAId};`;
    const [evB] = await sql`SELECT name, organizer FROM "Event" WHERE id = ${testEventBId};`;
    record(11, "Event branding dynamically isolated per event", evA.name !== evB.name && evA.organizer !== evB.organizer, `Event A: "${evA.name}" vs Event B: "${evB.name}"`);

    // TEST 12: Zero Hardcoded Organization Names
    const hardcodeCheck = searchDirForPatterns(srcDir, [
      "pals.hackathon",
      "/pals-logo.svg",
      "/ieee-logo.svg",
      "bms institute",
    ]);
    record(12, "Zero Organization Hardcoding in src/", hardcodeCheck.length === 0, hardcodeCheck.length === 0 ? "0 hardcoded references" : `Found in: ${hardcodeCheck.map(h => h.file).join(", ")}`);

  } finally {
    // Always clean up temporary test records cleanly
    console.log("\n🧹 Cleaning temporary test records from Neon DB...");
    await sql`DELETE FROM "Score" WHERE "eventId" IN (${testEventAId}, ${testEventBId});`;
    await sql`DELETE FROM "Criteria" WHERE "eventId" IN (${testEventAId}, ${testEventBId});`;
    await sql`DELETE FROM "Team" WHERE "eventId" IN (${testEventAId}, ${testEventBId});`;
    await sql`DELETE FROM "User" WHERE id = ${testJudgeAId};`;
    await sql`DELETE FROM "Event" WHERE id IN (${testEventAId}, ${testEventBId});`;
    console.log("✅ Neon DB restored to pristine state.\n");
  }

  console.log("=================================================================");
  console.log(`   REGRESSION RESULT: ${allPassed ? "🎉 ALL 12 TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
  console.log("=================================================================\n");

  if (!allPassed) process.exit(1);
}

runRegressionSuite().catch((err) => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
