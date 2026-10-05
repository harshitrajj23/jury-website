"use server";

import type { Judge, Team, ScoringCriteria, ScoreRecord, AppConfig, LeaderboardEntry } from "./types";
import { getDb } from "./neonClient";



/**
 * Initializes database schema in Neon Postgres automatically if tables do not exist.
 */
export async function initDatabase(): Promise<void> {
  try {
    const sql = getDb();
    
    // Create pals_judges table
    await sql`
      CREATE TABLE IF NOT EXISTS pals_judges (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        designation TEXT NOT NULL,
        password TEXT
      );
    `;

    // Create pals_teams table
    await sql`
      CREATE TABLE IF NOT EXISTS pals_teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
    `;

    // Create pals_config table
    await sql`
      CREATE TABLE IF NOT EXISTS pals_config (
        id TEXT PRIMARY KEY,
        "announceResults" BOOLEAN DEFAULT FALSE,
        "criteriaList" JSONB DEFAULT '[]'::jsonb,
        "timerDuration" INTEGER DEFAULT 480
      );
    `;

    // Seed default config if missing
    await sql`
      INSERT INTO pals_config (id, "announceResults", "criteriaList", "timerDuration")
      VALUES ('main', FALSE, '[]'::jsonb, 480)
      ON CONFLICT (id) DO NOTHING;
    `;

    // Create pals_scores table
    await sql`
      CREATE TABLE IF NOT EXISTS pals_scores (
        "teamId" TEXT NOT NULL,
        "judgeId" TEXT NOT NULL,
        scores JSONB NOT NULL DEFAULT '{}'::jsonb,
        "totalScore" NUMERIC NOT NULL DEFAULT 0,
        "submittedAt" TEXT NOT NULL,
        "judgeSignOff" JSONB DEFAULT '{}'::jsonb,
        PRIMARY KEY ("teamId", "judgeId")
      );
    `;
  } catch (err) {
    console.error("Database initialization error (Neon DB):", err);
  }
}

// JUDGES
export async function getJudges(): Promise<Judge[]> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, username, name, designation, password 
      FROM pals_judges 
      ORDER BY name ASC
    `;
    return (rows || []) as Judge[];
  } catch (error) {
    console.error("Neon DB Error (getJudges):", error);
    return [];
  }
}

export async function addJudge(judge: Omit<Judge, "id">): Promise<Judge> {
  const sql = getDb();
  const newJudge: Judge = {
    ...judge,
    id: `j_${Date.now()}`,
  };
  await sql`
    INSERT INTO pals_judges (id, username, name, designation, password)
    VALUES (${newJudge.id}, ${newJudge.username}, ${newJudge.name}, ${newJudge.designation}, ${newJudge.password || null})
  `;
  return newJudge;
}

export async function removeJudge(id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM pals_judges WHERE id = ${id}`;
}

// TEAMS
export async function getTeams(): Promise<Team[]> {
  try {
    const sql = getDb();
    const rows = await sql`SELECT id, name FROM pals_teams ORDER BY id ASC`;
    return (rows || []) as Team[];
  } catch (error) {
    console.error("Neon DB Error (getTeams):", error);
    return [];
  }
}

export async function addTeam(name: string): Promise<Team> {
  const sql = getDb();
  const newTeam: Team = {
    id: `t_${Date.now()}`,
    name,
  };
  await sql`INSERT INTO pals_teams (id, name) VALUES (${newTeam.id}, ${newTeam.name})`;
  return newTeam;
}

export async function removeTeam(id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM pals_teams WHERE id = ${id}`;
}

export async function toggleDisqualifyTeam(teamId: string, teamName: string, disqualify: boolean): Promise<void> {
  const sql = getDb();
  let newName = teamName;
  if (disqualify && !teamName.startsWith("[DISQUALIFIED]")) {
    newName = `[DISQUALIFIED] ${teamName}`;
  } else if (!disqualify && teamName.startsWith("[DISQUALIFIED]")) {
    newName = teamName.replace("[DISQUALIFIED] ", "");
  }
  await sql`UPDATE pals_teams SET name = ${newName} WHERE id = ${teamId}`;
}

// CONFIG & CRITERIA
export async function getConfig(): Promise<AppConfig> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT "announceResults", "criteriaList", "timerDuration" 
      FROM pals_config 
      WHERE id = 'main'
      LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      return {
        announceResults: false,
        criteriaList: [],
        timerDuration: 480,
      };
    }
    const data = rows[0];
    const criteriaList = typeof data.criteriaList === "string" 
      ? JSON.parse(data.criteriaList) 
      : (data.criteriaList || []);

    return {
      announceResults: Boolean(data.announceResults),
      criteriaList,
      timerDuration: Number(data.timerDuration) || 480,
    };
  } catch (error) {
    console.error("Neon DB Error (getConfig):", error);
    return {
      announceResults: false,
      criteriaList: [],
      timerDuration: 480,
    };
  }
}

export async function updateTimerDuration(durationSeconds: number): Promise<void> {
  const sql = getDb();
  await sql`UPDATE pals_config SET "timerDuration" = ${durationSeconds} WHERE id = 'main'`;
}

export async function updateConfig(config: AppConfig): Promise<void> {
  const sql = getDb();
  const criteriaJson = JSON.stringify(config.criteriaList || []);
  await sql`
    UPDATE pals_config 
    SET "announceResults" = ${config.announceResults}, 
        "criteriaList" = ${criteriaJson}::jsonb, 
        "timerDuration" = ${config.timerDuration} 
    WHERE id = 'main'
  `;
}

export async function toggleAnnounceResults(announce: boolean): Promise<void> {
  const sql = getDb();
  await sql`UPDATE pals_config SET "announceResults" = ${announce} WHERE id = 'main'`;
}

export async function updateCriteria(criteriaList: ScoringCriteria[]): Promise<void> {
  const sql = getDb();
  const criteriaJson = JSON.stringify(criteriaList || []);
  await sql`UPDATE pals_config SET "criteriaList" = ${criteriaJson}::jsonb WHERE id = 'main'`;
}

// SCORES & EVALUATIONS
export async function getScores(): Promise<ScoreRecord[]> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT "teamId", "judgeId", scores, "totalScore", "submittedAt", "judgeSignOff" 
      FROM pals_scores
    `;
    return (rows || []).map((r: any) => ({
      teamId: r.teamId,
      judgeId: r.judgeId,
      scores: typeof r.scores === "string" ? JSON.parse(r.scores) : (r.scores || {}),
      totalScore: Number(r.totalScore) || 0,
      submittedAt: r.submittedAt,
      judgeSignOff: typeof r.judgeSignOff === "string" ? JSON.parse(r.judgeSignOff) : (r.judgeSignOff || {}),
    })) as ScoreRecord[];
  } catch (error) {
    console.error("Neon DB Error (getScores):", error);
    return [];
  }
}

export async function submitScores(score: ScoreRecord): Promise<void> {
  const sql = getDb();
  const scoresJson = JSON.stringify(score.scores || {});
  const signOffJson = JSON.stringify(score.judgeSignOff || {});

  await sql`
    INSERT INTO pals_scores ("teamId", "judgeId", scores, "totalScore", "submittedAt", "judgeSignOff")
    VALUES (${score.teamId}, ${score.judgeId}, ${scoresJson}::jsonb, ${score.totalScore}, ${score.submittedAt}, ${signOffJson}::jsonb)
    ON CONFLICT ("teamId", "judgeId")
    DO UPDATE SET
      scores = EXCLUDED.scores,
      "totalScore" = EXCLUDED."totalScore",
      "submittedAt" = EXCLUDED."submittedAt",
      "judgeSignOff" = EXCLUDED."judgeSignOff"
  `;
}

// Leaderboard calculations
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const allTeams = await getTeams();
  const judges = await getJudges();
  const scores = await getScores();
  
  // Filter out disqualified teams
  const teams = allTeams.filter(t => !t.name.startsWith("[DISQUALIFIED]"));
  
  const entries: Omit<LeaderboardEntry, "rank">[] = teams.map((team) => {
    const teamScores = scores.filter((s) => s.teamId === team.id);
    
    const judgeSubmissions = teamScores.map((ts) => {
      const judge = judges.find((j) => j.id === ts.judgeId);
      return {
        judgeId: ts.judgeId,
        judgeName: judge ? judge.name : "Unknown Judge",
        totalScore: ts.totalScore,
      };
    });
    
    const averageScore =
      teamScores.length > 0
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
      averageScore,
      judgeSubmissions,
    };
  });
  
  const sorted = entries.sort((a, b) => b.averageScore - a.averageScore);
  
  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

// Database Reset
export async function resetDatabase(): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM pals_scores WHERE "teamId" != 'impossible'`;
  await sql`DELETE FROM pals_teams WHERE id != 'impossible'`;
  await sql`DELETE FROM pals_judges WHERE id != 'impossible'`;
}
