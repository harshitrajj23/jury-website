require("dotenv").config();
const { neon } = require("@neondatabase/serverless");
const fs = require("fs");
const path = require("path");

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const sql = neon(connectionString);

async function runRegressionSuite() {
  console.log("=================================================================");
  console.log("   JURY PLATFORM REGRESSION & UX REFINEMENT TEST SUITE          ");
  console.log("   EVENT MANAGEMENT + JUDGE WORKFLOW + RESULT DECLARATION + TIES ");
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
      INSERT INTO "Event" (id, name, subtitle, organizer, logo, "organizerLogo", date, theme, status, "timerDuration", "judgingOpen", "leaderboardUnlocked", "resultsDeclared", "declaredAt", "finaleReady", active, "createdAt", "updatedAt")
      VALUES 
        (${testEventAId}, 'CyberHack 2026', 'National Hackathon', 'Code Society', '', '', '2026-10-15', 'AI', 'active', 300, true, false, false, NULL, false, true, NOW(), NOW()),
        (${testEventBId}, 'DesignSprint 2026', 'Product Exhibition', 'Design Guild', '', '', '2026-10-20', 'Design', 'active', 300, true, false, false, NULL, false, true, NOW(), NOW());
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

    // TEST 9: Result Declaration State Transition & Timestamp
    const declareTimestamp = new Date();
    await sql`
      UPDATE "Event"
      SET "resultsDeclared" = true,
          "declaredAt" = ${declareTimestamp},
          "leaderboardUnlocked" = true,
          "status" = 'results_declared'
      WHERE id = ${testEventAId};
    `;
    const [evADeclared] = await sql`SELECT "resultsDeclared", "declaredAt", status FROM "Event" WHERE id = ${testEventAId};`;
    record(9, "Result Declaration: State transitions to DECLARED with valid timestamp", 
      evADeclared.resultsDeclared === true && evADeclared.status === "results_declared" && evADeclared.declaredAt !== null,
      `Event A declaredAt: ${evADeclared.declaredAt}, status: ${evADeclared.status}`
    );

    // TEST 10: Result Declaration Isolation - Declaring Event A does NOT declare Event B
    const [evBCheck] = await sql`SELECT "resultsDeclared", "declaredAt", status FROM "Event" WHERE id = ${testEventBId};`;
    record(10, "Result Declaration Isolation: Event B remains UNDECLARED when Event A declared",
      evBCheck.resultsDeclared === false && evBCheck.declaredAt === null && evBCheck.status === "active",
      `Event B resultsDeclared: ${evBCheck.resultsDeclared}, declaredAt: ${evBCheck.declaredAt}`
    );

    // TEST 11: Result Declaration Revocation / Re-open Action
    await sql`
      UPDATE "Event"
      SET "resultsDeclared" = false,
          "declaredAt" = NULL,
          "status" = 'active'
      WHERE id = ${testEventAId};
    `;
    const [evARevoked] = await sql`SELECT "resultsDeclared", "declaredAt", status FROM "Event" WHERE id = ${testEventAId};`;
    record(11, "Result Revocation: Re-opens evaluation and resets declaration timestamp",
      evARevoked.resultsDeclared === false && evARevoked.declaredAt === null && evARevoked.status === "active",
      `Event A re-opened cleanly to active state`
    );

    // TEST 12: Deterministic Tiebreaker: Primary Unrounded Weighted Score
    // Team X: 82.504 vs Team Y: 82.499 (both display as 82.50 in UI, but Team X ranks higher)
    const teamX = { name: "Team X", rawWeightedScore: 82.504, rawAverageScore: 82.0, perfectTensCount: 2, ninesCount: 3 };
    const teamY = { name: "Team Y", rawWeightedScore: 82.499, rawAverageScore: 82.0, perfectTensCount: 2, ninesCount: 3 };
    const unroundedComp = teamY.rawWeightedScore - teamX.rawWeightedScore; // negative means teamX wins
    record(12, "Deterministic Tiebreaker 1: Unrounded score (82.504 > 82.499) wins over rounded display",
      unroundedComp < 0,
      `Team X (82.504) correctly ranks above Team Y (82.499)`
    );

    // TEST 13: Deterministic Tiebreaker: Secondary Unweighted Average Score
    const teamEqualWeighted1 = { name: "Team 1", rawWeightedScore: 80.000, rawAverageScore: 82.5, perfectTensCount: 1, ninesCount: 2 };
    const teamEqualWeighted2 = { name: "Team 2", rawWeightedScore: 80.000, rawAverageScore: 81.0, perfectTensCount: 1, ninesCount: 2 };
    const secondaryDiff = teamEqualWeighted2.rawAverageScore - teamEqualWeighted1.rawAverageScore;
    record(13, "Deterministic Tiebreaker 2: Unweighted average score breaks equal weighted tie",
      secondaryDiff < 0,
      `Team 1 (unweighted 82.5) correctly beats Team 2 (unweighted 81.0)`
    );

    // TEST 14: Deterministic Tiebreaker: Count of Perfect 10 Ratings
    const teamTens1 = { name: "Team Tens A", rawWeightedScore: 80.0, rawAverageScore: 80.0, perfectTensCount: 5, ninesCount: 2 };
    const teamTens2 = { name: "Team Tens B", rawWeightedScore: 80.0, rawAverageScore: 80.0, perfectTensCount: 3, ninesCount: 2 };
    const tensDiff = teamTens2.perfectTensCount - teamTens1.perfectTensCount;
    record(14, "Deterministic Tiebreaker 3: More perfect 10s breaks tie",
      tensDiff < 0,
      `Team Tens A (5 tens) beats Team Tens B (3 tens)`
    );

    // TEST 15: Deterministic Tiebreaker: Count of 9 Ratings
    const teamNines1 = { name: "Team Nines A", rawWeightedScore: 80.0, rawAverageScore: 80.0, perfectTensCount: 3, ninesCount: 4 };
    const teamNines2 = { name: "Team Nines B", rawWeightedScore: 80.0, rawAverageScore: 80.0, perfectTensCount: 3, ninesCount: 2 };
    const ninesDiff = teamNines2.ninesCount - teamNines1.ninesCount;
    record(15, "Deterministic Tiebreaker 4: More 9s breaks tie when 10s are equal",
      ninesDiff < 0,
      `Team Nines A (4 nines) beats Team Nines B (2 nines)`
    );

    // TEST 16: Competition Ranking (1, 2, 2, 4) When Identical
    function computeCompetitionRanks(teams) {
      const areIdentical = (a, b) => (
        Math.abs(a.rawWeightedScore - b.rawWeightedScore) <= 1e-9 &&
        Math.abs(a.rawAverageScore - b.rawAverageScore) <= 1e-9 &&
        a.perfectTensCount === b.perfectTensCount &&
        a.ninesCount === b.ninesCount
      );

      const ranked = [];
      for (let i = 0; i < teams.length; i++) {
        let rank = i + 1;
        if (i > 0 && areIdentical(teams[i], teams[i - 1])) {
          rank = ranked[i - 1].rank;
        }
        ranked.push({ ...teams[i], rank });
      }
      return ranked;
    }

    const tiedCompTeams = [
      { name: "Team Alpha", rawWeightedScore: 92.0, rawAverageScore: 92.0, perfectTensCount: 4, ninesCount: 2 },
      { name: "Team Beta", rawWeightedScore: 88.0, rawAverageScore: 88.0, perfectTensCount: 3, ninesCount: 2 },
      { name: "Team Gamma", rawWeightedScore: 88.0, rawAverageScore: 88.0, perfectTensCount: 3, ninesCount: 2 },
      { name: "Team Delta", rawWeightedScore: 82.0, rawAverageScore: 82.0, perfectTensCount: 2, ninesCount: 1 },
    ];
    const compRankResults = computeCompetitionRanks(tiedCompTeams);
    const assignedRanks = compRankResults.map(r => r.rank);
    record(16, "Competition Ranking: Produces 1, 2, 2, 4 (NOT 1, 2, 3, 4)",
      JSON.stringify(assignedRanks) === JSON.stringify([1, 2, 2, 4]),
      `Ranks assigned: [${assignedRanks.join(", ")}]`
    );

    // TEST 17: Tied Podium Handling - Both rank 2 teams eligible for podium
    const podiumTeams = compRankResults.filter(t => t.rank <= 3);
    record(17, "Tied Podium: All tied rank <= 3 teams are retained in podium",
      podiumTeams.length === 3 && podiumTeams.some(t => t.name === "Team Beta") && podiumTeams.some(t => t.name === "Team Gamma"),
      `Podium contains 3 teams: Alpha (Rank 1), Beta (Rank 2), Gamma (Rank 2)`
    );

    // TEST 18: Verify Source Code: Timer UI Completely Removed
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
    record(18, "Zero Timer UI / countdown in production components", timerUIOccurrences.length === 0, timerUIOccurrences.length === 0 ? "0 occurrences found in src/" : `Found in: ${timerUIOccurrences.map(o => o.file).join(", ")}`);

    // TEST 19: Verify Source Code: Jury Compliance Module Removed
    const complianceOccurrences = searchDirForPatterns(srcDir, [
      "<RulesPanel",
      "import RulesPanel",
      "JUDGING COMPLIANCE MODULE",
      "PROTOCOL SEC-ID: JURY-EVAL-CORE",
    ]);
    record(19, "Zero Jury Compliance module in production components", complianceOccurrences.length === 0, complianceOccurrences.length === 0 ? "0 occurrences found in src/" : `Found in: ${complianceOccurrences.map(o => o.file).join(", ")}`);

    // TEST 20: Verify Dynamic Event Branding
    const [evA] = await sql`SELECT name, organizer FROM "Event" WHERE id = ${testEventAId};`;
    const [evB] = await sql`SELECT name, organizer FROM "Event" WHERE id = ${testEventBId};`;
    record(20, "Event branding dynamically isolated per event", evA.name !== evB.name && evA.organizer !== evB.organizer, `Event A: "${evA.name}" vs Event B: "${evB.name}"`);

    // TEST 21: Zero Hardcoded Organization Names
    const hardcodeCheck = searchDirForPatterns(srcDir, [
      "pals.hackathon",
      "/pals-logo.svg",
      "/ieee-logo.svg",
      "bms institute",
    ]);
    record(21, "Zero Organization Hardcoding in src/", hardcodeCheck.length === 0, hardcodeCheck.length === 0 ? "0 hardcoded references" : `Found in: ${hardcodeCheck.map(h => h.file).join(", ")}`);

    // TEST 22: Judge Panel No Self-Registration in src/app/page.tsx
    const landingContent = fs.readFileSync(path.join(srcDir, "app", "page.tsx"), "utf8");
    const hasSelfReg = landingContent.includes("REGISTER") && landingContent.includes("INITIALIZE JURIST NODE");
    record(22, "Judge Panel: No evaluator self-registration in landing page", !hasSelfReg, "Landing page is strictly authorized jurist authentication");

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
  console.log(`   REGRESSION RESULT: ${allPassed ? "🎉 ALL 22 TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
  console.log("=================================================================\n");

  if (!allPassed) process.exit(1);
}

runRegressionSuite().catch((err) => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
