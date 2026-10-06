require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const sql = neon(connectionString);

const BASE_URL = process.env.APP_URL || "http://localhost:3000";

// Replicate db operations exactly as implemented in db.ts
async function submitScoresBatch(score) {
  if (!score || !score.teamId || !score.judgeId) {
    return { success: false, error: "VALIDATION_ERROR: Missing team or judge identifier." };
  }

  const scoreEntries = Object.entries(score.scores || {});
  if (scoreEntries.length === 0) {
    return { success: false, error: "VALIDATION_ERROR: Evaluation scores cannot be empty." };
  }

  const ids = [];
  const judgeIds = [];
  const teamIds = [];
  const critIds = [];
  const scoreVals = [];
  const comments = [];

  for (const [criteriaId, rawVal] of scoreEntries) {
    const val = Number(rawVal);
    if (!Number.isFinite(val) || !Number.isInteger(val) || val < 1 || val > 10) {
      return { 
        success: false, 
        error: `VALIDATION_ERROR: Invalid score value (${rawVal}) for criteria ${criteriaId}. Scores must be whole integers between 1 and 10.` 
      };
    }

    const id = `sc_${score.teamId}_${score.judgeId}_${criteriaId}`;
    ids.push(id);
    judgeIds.push(score.judgeId);
    teamIds.push(score.teamId);
    critIds.push(criteriaId);
    scoreVals.push(val);
    comments.push('');
  }

  try {
    await sql`
      INSERT INTO "Score" (id, "judgeId", "teamId", "criteriaId", score, comment, "createdAt", "updatedAt")
      SELECT 
        unnest(${ids}::text[]),
        unnest(${judgeIds}::text[]),
        unnest(${teamIds}::text[]),
        unnest(${critIds}::text[]),
        unnest(${scoreVals}::int[]),
        unnest(${comments}::text[]),
        NOW(),
        NOW()
      ON CONFLICT (id) DO UPDATE SET
        score = EXCLUDED.score,
        comment = EXCLUDED.comment,
        "updatedAt" = NOW();
    `;

    const [teamCountRes, evaluatedCountRes] = await Promise.all([
      sql`SELECT count(*)::int as count FROM "Team" WHERE "teamName" NOT LIKE '[DISQUALIFIED]%';`,
      sql`SELECT count(DISTINCT "teamId")::int as count FROM "Score" WHERE "judgeId" = ${score.judgeId};`,
    ]);

    const totalActiveTeams = teamCountRes[0]?.count || 0;
    const evaluatedTeams = evaluatedCountRes[0]?.count || 0;
    const isJudgeFullyComplete = totalActiveTeams > 0 && evaluatedTeams >= totalActiveTeams;

    await sql`
      UPDATE "User" 
      SET completed = ${isJudgeFullyComplete}, 
          "updatedAt" = NOW() 
      WHERE id = ${score.judgeId};
    `;

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getLeaderboardCalc() {
  const [allTeams, judges, scores, criteriaList] = await Promise.all([
    sql`SELECT id, "teamName" as name, "projectName" FROM "Team" ORDER BY "teamName" ASC;`,
    sql`SELECT id, name FROM "User";`,
    sql`SELECT s.id, s."judgeId", s."teamId", s."criteriaId", s.score FROM "Score" s;`,
    sql`SELECT id, name, weight, "maxScore" FROM "Criteria" WHERE active = true ORDER BY "orderIndex" ASC;`,
  ]);

  const criteriaMap = new Map();
  let totalWeight = 0;
  criteriaList.forEach((c) => {
    const w = parseFloat(c.weight) || 1.0;
    criteriaMap.set(c.id, { ...c, weight: w });
    totalWeight += w;
  });

  const weightMultiplier = (totalWeight > 0 && totalWeight <= 1.5) ? 10.0 : 1.0;

  // Group scores by (teamId, judgeId)
  const grouped = new Map();
  for (const s of scores) {
    const key = `${s.teamId}_${s.judgeId}`;
    if (!grouped.has(key)) {
      grouped.set(key, { teamId: s.teamId, judgeId: s.judgeId, scores: {}, totalScore: 0 });
    }
    const rec = grouped.get(key);
    rec.scores[s.criteriaId] = s.score;
    rec.totalScore += s.score;
  }

  const scoreRecords = Array.from(grouped.values());
  const activeTeams = allTeams.filter((t) => !t.name.startsWith("[DISQUALIFIED]"));

  const entries = activeTeams.map((team) => {
    const teamScores = scoreRecords.filter((s) => s.teamId === team.id);

    const judgeSubmissions = teamScores.map((ts) => {
      const judge = judges.find((j) => j.id === ts.judgeId);
      let weightedTotal = 0;
      for (const [critId, val] of Object.entries(ts.scores || {})) {
        const crit = criteriaMap.get(critId);
        const w = crit ? crit.weight : 1.0;
        weightedTotal += (val * w);
      }
      const weightedScore = parseFloat((weightedTotal * weightMultiplier).toFixed(2));
      return {
        judgeId: ts.judgeId,
        judgeName: judge ? judge.name : "Judge",
        totalScore: ts.totalScore,
        weightedScore,
      };
    });

    const averageScore = teamScores.length > 0
      ? parseFloat(
          (
            judgeSubmissions.reduce((sum, s) => sum + (s.weightedScore || s.totalScore), 0) /
            judgeSubmissions.length
          ).toFixed(2)
        )
      : 0;

    const rawAverageScore = teamScores.length > 0
      ? parseFloat(
          (
            teamScores.reduce((sum, s) => sum + s.totalScore, 0) /
            teamScores.length
          ).toFixed(2)
        )
      : 0;

    return {
      teamId: team.id,
      teamName: team.name,
      projectName: team.projectName,
      averageScore,
      rawAverageScore,
      judgeSubmissions,
    };
  });

  const sorted = entries.sort((a, b) => {
    if (b.averageScore !== a.averageScore) {
      return b.averageScore - a.averageScore;
    }
    return (b.rawAverageScore || 0) - (a.rawAverageScore || 0);
  });

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

function calculateP95(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  return sorted[idx] || sorted[sorted.length - 1];
}

async function runComprehensiveVerification() {
  console.log("=================================================================");
  console.log("   LIVE HACKATHON PLATFORM — FULL PIPELINE VERIFICATION SUITE");
  console.log("=================================================================\n");

  // -------------------------------------------------------------
  // TEST 1: DB HEALTH ENDPOINT PERFORMANCE
  // -------------------------------------------------------------
  console.log("--- TEST 1: /api/db-health PERFORMANCE ---");
  const healthStart = performance.now();
  const healthRes = await fetch(`${BASE_URL}/api/db-health`);
  const healthDuration = performance.now() - healthStart;
  const healthJson = await healthRes.json();
  console.log(`Status: ${healthRes.status}, Duration: ${healthDuration.toFixed(2)} ms`);
  console.log(`Response:`, healthJson);
  console.log(`Target: <500 ms -> ${healthDuration < 500 ? "✅ PASS" : "❌ FAIL"}\n`);

  // -------------------------------------------------------------
  // TEST 2: ATOMIC BATCH SCORE SUBMISSION PERFORMANCE
  // -------------------------------------------------------------
  console.log("--- TEST 2: ATOMIC SCORE SUBMISSION PERFORMANCE ---");
  const judges = await sql`SELECT id, name FROM "User" LIMIT 1;`;
  const teams = await sql`SELECT id, "teamName" FROM "Team" LIMIT 1;`;
  const activeCriteria = await sql`SELECT id, name, weight FROM "Criteria" WHERE active = true ORDER BY "orderIndex" ASC;`;

  if (judges.length === 0 || teams.length === 0 || activeCriteria.length === 0) {
    console.error("Missing seed data (judges, teams, criteria)");
    return;
  }

  const testJudge = judges[0];
  const testTeam = teams[0];

  const validScores = {};
  activeCriteria.forEach((c, i) => {
    validScores[c.id] = (i % 5) + 5; // scores 5, 6, 7, 8, 9
  });

  const subStart = performance.now();
  const subRes = await submitScoresBatch({
    teamId: testTeam.id,
    judgeId: testJudge.id,
    scores: validScores,
    totalScore: Object.values(validScores).reduce((a, b) => a + b, 0),
    submittedAt: new Date().toISOString(),
  });
  const subDuration = performance.now() - subStart;

  console.log(`Submission Result: ${subRes.success ? "SUCCESS" : "FAILED (" + subRes.error + ")"}`);
  console.log(`Measured Submission Duration: ${subDuration.toFixed(2)} ms`);
  console.log(`Target: <1000 ms -> ${subDuration < 1000 ? "✅ PASS" : "❌ FAIL"}\n`);

  // -------------------------------------------------------------
  // TEST 3: BACKEND SCORE VALIDATION & ATOMIC REJECTION
  // -------------------------------------------------------------
  console.log("--- TEST 3: BACKEND SCORE VALIDATION & ATOMIC REJECTION ---");
  const invalidCases = [
    { name: "Negative score (-5)", scores: { [activeCriteria[0].id]: -5 } },
    { name: "Score over max (99)", scores: { [activeCriteria[0].id]: 99 } },
    { name: "Zero score (0)", scores: { [activeCriteria[0].id]: 0 } },
    { name: "String score ('abc')", scores: { [activeCriteria[0].id]: 'abc' } },
    { name: "Decimal score (5.5)", scores: { [activeCriteria[0].id]: 5.5 } },
    { name: "NaN score", scores: { [activeCriteria[0].id]: NaN } },
    { name: "Infinity score", scores: { [activeCriteria[0].id]: Infinity } },
    { name: "Empty scores object", scores: {} },
  ];

  for (const tc of invalidCases) {
    const res = await submitScoresBatch({
      teamId: testTeam.id,
      judgeId: testJudge.id,
      scores: tc.scores,
      totalScore: 0,
      submittedAt: new Date().toISOString(),
    });
    console.log(`Case "${tc.name}": Rejected=${!res.success} (Error: ${res.error}) -> ${!res.success ? "✅ PASS" : "❌ FAIL"}`);
  }
  console.log("");

  // -------------------------------------------------------------
  // TEST 4: WEIGHTED LEADERBOARD CALCULATION ACCURACY
  // -------------------------------------------------------------
  console.log("--- TEST 4: WEIGHTED LEADERBOARD CALCULATION ACCURACY ---");
  const tmHighId = `tm_high_${Date.now()}`;
  const tmLowId = `tm_low_${Date.now()}`;
  await sql`
    INSERT INTO "Team" (id, "teamName", "projectName", "teamCode", "tableNumber", members, "createdAt", "updatedAt")
    VALUES 
      (${tmHighId}, 'Team Alpha Weighted', 'AI Project', 'TEAM-WT1', 1, '[]', NOW(), NOW()),
      (${tmLowId}, 'Team Beta Raw', 'Basic Project', 'TEAM-WT2', 2, '[]', NOW(), NOW());
  `;

  // Custom criteria weights test
  await sql`
    INSERT INTO "Criteria" (id, name, description, "maxScore", weight, "orderIndex", active)
    VALUES 
      ('crit_test_hi', 'High Weight Criterion', 'Innovation', 10, 0.8, 90, true),
      ('crit_test_lo', 'Low Weight Criterion', 'Syntax', 10, 0.2, 91, true)
    ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight, active = true;
  `;

  // Team Alpha scores 10 on 0.8 weight criterion, 2 on 0.2 weight criterion -> Weighted = 10*0.8 + 2*0.2 = 8.4
  // Team Beta scores 2 on 0.8 weight criterion, 10 on 0.2 weight criterion -> Weighted = 2*0.8 + 10*0.2 = 3.6
  await submitScoresBatch({
    teamId: tmHighId,
    judgeId: testJudge.id,
    scores: { crit_test_hi: 10, crit_test_lo: 2 },
    totalScore: 12,
  });

  await submitScoresBatch({
    teamId: tmLowId,
    judgeId: testJudge.id,
    scores: { crit_test_hi: 2, crit_test_lo: 10 },
    totalScore: 12,
  });

  const lbResults = await getLeaderboardCalc();
  const entryHigh = lbResults.find(e => e.teamId === tmHighId);
  const entryLow = lbResults.find(e => e.teamId === tmLowId);

  console.log(`Leaderboard Results for Weighted vs Raw:`);
  console.log(`Team Alpha: Weighted Avg = ${entryHigh?.averageScore}, Raw Avg = ${entryHigh?.rawAverageScore}, Rank = #${entryHigh?.rank}`);
  console.log(`Team Beta: Weighted Avg = ${entryLow?.averageScore}, Raw Avg = ${entryLow?.rawAverageScore}, Rank = #${entryLow?.rank}`);

  const isWeightedCorrect = entryHigh && entryLow && entryHigh.averageScore > entryLow.averageScore && entryHigh.rank < entryLow.rank;
  console.log(`Weighted Scoring Order Verification: ${isWeightedCorrect ? "✅ PASS (Ranked by weights correctly!)" : "❌ FAIL"}\n`);

  // Clean up test teams & custom test criteria
  await sql`DELETE FROM "Score" WHERE "teamId" IN (${tmHighId}, ${tmLowId});`;
  await sql`DELETE FROM "Team" WHERE id IN (${tmHighId}, ${tmLowId});`;
  await sql`DELETE FROM "Criteria" WHERE id IN ('crit_test_hi', 'crit_test_lo');`;

  // -------------------------------------------------------------
  // TEST 5: TIMER DURATION PERSISTENCE
  // -------------------------------------------------------------
  console.log("--- TEST 5: TIMER DURATION PERSISTENCE ---");
  await sql`UPDATE "Settings" SET "timerDuration" = 600, "updatedAt" = NOW() WHERE id = 'global';`;
  const [s1] = await sql`SELECT "timerDuration" FROM "Settings" WHERE id = 'global';`;
  console.log(`Updated timer to 600s -> Stored value: ${s1.timerDuration}s (${s1.timerDuration === 600 ? "✅ PASS" : "❌ FAIL"})`);

  await sql`UPDATE "Settings" SET "timerDuration" = 480, "updatedAt" = NOW() WHERE id = 'global';`;
  const [s2] = await sql`SELECT "timerDuration" FROM "Settings" WHERE id = 'global';`;
  console.log(`Restored timer to 480s -> Stored value: ${s2.timerDuration}s (${s2.timerDuration === 480 ? "✅ PASS" : "❌ FAIL"})\n`);

  // -------------------------------------------------------------
  // TEST 6: JUDGE COMPLETION STATUS CALCULATION
  // -------------------------------------------------------------
  console.log("--- TEST 6: JUDGE COMPLETION STATUS ACCURACY ---");
  const tempJudgeId = `usr_compl_${Date.now()}`;
  await sql`
    INSERT INTO "User" (id, name, email, "passwordHash", role, completed, "createdAt", "updatedAt")
    VALUES (${tempJudgeId}, 'Completion Test Judge', ${'compl_' + Date.now() + '@test.com'}, 'hash', 'judge', false, NOW(), NOW());
  `;

  const activeTeamsList = await sql`SELECT id FROM "Team" WHERE "teamName" NOT LIKE '[DISQUALIFIED]%';`;
  console.log(`Active teams in hackathon: ${activeTeamsList.length}`);

  if (activeTeamsList.length >= 2) {
    // 1. Submit team 1
    await submitScoresBatch({
      teamId: activeTeamsList[0].id,
      judgeId: tempJudgeId,
      scores: { [activeCriteria[0].id]: 8 },
      totalScore: 8,
      submittedAt: new Date().toISOString(),
    });

    const [u1] = await sql`SELECT completed FROM "User" WHERE id = ${tempJudgeId};`;
    console.log(`After submitting 1 of ${activeTeamsList.length} teams: completed = ${u1.completed} (Expected: false -> ${!u1.completed ? "✅ PASS" : "❌ FAIL"})`);

    // 2. Submit all remaining teams
    for (let i = 1; i < activeTeamsList.length; i++) {
      await submitScoresBatch({
        teamId: activeTeamsList[i].id,
        judgeId: tempJudgeId,
        scores: { [activeCriteria[0].id]: 8 },
        totalScore: 8,
        submittedAt: new Date().toISOString(),
      });
    }

    const [uAll] = await sql`SELECT completed FROM "User" WHERE id = ${tempJudgeId};`;
    console.log(`After submitting all ${activeTeamsList.length} teams: completed = ${uAll.completed} (Expected: true -> ${uAll.completed ? "✅ PASS" : "❌ FAIL"})`);
  }

  // Clean up
  await sql`DELETE FROM "Score" WHERE "judgeId" = ${tempJudgeId};`;
  await sql`DELETE FROM "User" WHERE id = ${tempJudgeId};`;
  console.log("");

  // -------------------------------------------------------------
  // TEST 7: CONCURRENT JURY LOAD TEST (5, 10, 20, 50 USERS)
  // -------------------------------------------------------------
  console.log("--- TEST 7: CONCURRENT JURY LOAD BENCHMARK ---");
  const concurrencyTiers = [5, 10, 20, 50];
  const concurrencyReport = [];

  for (const userCount of concurrencyTiers) {
    // Create temp judges
    const userIds = [];
    for (let i = 0; i < userCount; i++) {
      const uId = `usr_load_${userCount}_${i}_${Date.now()}`;
      userIds.push(uId);
      await sql`
        INSERT INTO "User" (id, name, email, "passwordHash", role, completed, "createdAt", "updatedAt")
        VALUES (${uId}, ${'Judge ' + i}, ${'judge_load_' + userCount + '_' + i + '_' + Date.now() + '@load.test'}, 'pass', 'judge', false, NOW(), NOW());
      `;
    }

    const latencies = [];
    let errors = 0;

    const startTotal = performance.now();
    await Promise.all(
      userIds.map(async (uId, idx) => {
        const opStart = performance.now();
        try {
          // Simultaneous fetch + submission
          const [judgeScores, cfg] = await Promise.all([
            sql`SELECT * FROM "Score" WHERE "judgeId" = ${uId};`,
            sql`SELECT "timerDuration" FROM "Settings" WHERE id = 'global';`,
          ]);

          const scoresObj = {};
          activeCriteria.forEach((c) => {
            scoresObj[c.id] = (idx % 5) + 5;
          });

          const res = await submitScoresBatch({
            teamId: testTeam.id,
            judgeId: uId,
            scores: scoresObj,
            totalScore: Object.values(scoresObj).reduce((a, b) => a + b, 0),
            submittedAt: new Date().toISOString(),
          });

          if (!res.success) {
            errors++;
          }
          const opDuration = performance.now() - opStart;
          latencies.push(opDuration);
        } catch (err) {
          errors++;
          latencies.push(performance.now() - opStart);
        }
      })
    );
    const totalDuration = performance.now() - startTotal;

    const avg = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
    const p95 = calculateP95(latencies);
    const successRate = `${(((userCount - errors) / userCount) * 100).toFixed(1)}%`;

    concurrencyReport.push({
      "Concurrent Juries": userCount,
      "Success Rate": successRate,
      "Avg Latency (ms)": `${avg.toFixed(1)} ms`,
      "P95 Latency (ms)": `${p95.toFixed(1)} ms`,
      "Total Batch Time (s)": `${(totalDuration / 1000).toFixed(2)} s`,
      Errors: errors,
      Status: errors === 0 ? "PASS" : "DEGRADED",
    });

    // Cleanup temp judges and their scores
    for (const uId of userIds) {
      await sql`DELETE FROM "Score" WHERE "judgeId" = ${uId};`;
      await sql`DELETE FROM "User" WHERE id = ${uId};`;
    }
  }

  console.table(concurrencyReport);

  console.log("\n=================================================================");
  console.log("   COMPREHENSIVE VERIFICATION SUITE COMPLETE");
  console.log("=================================================================");
}

runComprehensiveVerification().catch(console.error);
