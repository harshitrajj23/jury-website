import { Judge, Team, ScoringCriteria, ScoreRecord, AppConfig } from "./types";
import { supabase } from "./supabaseClient";

// Helper to check environment
const isClient = () => typeof window !== "undefined";

export const initDatabase = async () => {
  // Handled automatically via Supabase SQL backend.
};

// JUDGES
export async function getJudges(): Promise<Judge[]> {
  const { data, error } = await supabase.from("pals_judges").select("*");
  if (error) {
    console.error("Supabase Error (getJudges):", error);
    return [];
  }
  return data || [];
}

export async function addJudge(judge: Omit<Judge, "id">): Promise<Judge> {
  const newJudge: Judge = {
    ...judge,
    id: `j_${Date.now()}`,
  };
  const { error } = await supabase.from("pals_judges").insert([newJudge]);
  if (error) throw error;
  return newJudge;
}

export async function removeJudge(id: string): Promise<void> {
  const { error } = await supabase.from("pals_judges").delete().eq("id", id);
  if (error) throw error;
}

// TEAMS
export async function getTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from("pals_teams").select("*");
  if (error) {
    console.error("Supabase Error (getTeams):", error);
    return [];
  }
  return data || [];
}

export async function addTeam(name: string): Promise<Team> {
  const newTeam: Team = {
    id: `t_${Date.now()}`,
    name,
  };
  const { error } = await supabase.from("pals_teams").insert([newTeam]);
  if (error) throw error;
  return newTeam;
}

export async function removeTeam(id: string): Promise<void> {
  const { error } = await supabase.from("pals_teams").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleDisqualifyTeam(teamId: string, teamName: string, disqualify: boolean): Promise<void> {
  let newName = teamName;
  if (disqualify && !teamName.startsWith("[DISQUALIFIED]")) {
    newName = `[DISQUALIFIED] ${teamName}`;
  } else if (!disqualify && teamName.startsWith("[DISQUALIFIED]")) {
    newName = teamName.replace("[DISQUALIFIED] ", "");
  }
  const { error } = await supabase.from("pals_teams").update({ name: newName }).eq("id", teamId);
  if (error) throw error;
}

// CONFIG & CRITERIA
export async function getConfig(): Promise<AppConfig> {
  const { data, error } = await supabase.from("pals_config").select("*").eq("id", "main").single();
  if (error || !data) {
    return {
      announceResults: false,
      criteriaList: [],
      timerDuration: 480,
    };
  }
  return {
    announceResults: data.announceResults,
    criteriaList: data.criteriaList,
    timerDuration: data.timerDuration,
  };
}

export async function updateTimerDuration(durationSeconds: number): Promise<void> {
  const { error } = await supabase.from("pals_config").update({ timerDuration: durationSeconds }).eq("id", "main");
  if (error) throw error;
}

export async function updateConfig(config: AppConfig): Promise<void> {
  const { error } = await supabase.from("pals_config").update({
    announceResults: config.announceResults,
    criteriaList: config.criteriaList,
    timerDuration: config.timerDuration
  }).eq("id", "main");
  if (error) throw error;
}

export async function toggleAnnounceResults(announce: boolean): Promise<void> {
  const { error } = await supabase.from("pals_config").update({ announceResults: announce }).eq("id", "main");
  if (error) throw error;
}

export async function updateCriteria(criteriaList: ScoringCriteria[]): Promise<void> {
  const { error } = await supabase.from("pals_config").update({ criteriaList }).eq("id", "main");
  if (error) throw error;
}

// SCORES & EVALUATIONS
export async function getScores(): Promise<ScoreRecord[]> {
  const { data, error } = await supabase.from("pals_scores").select("*");
  if (error) {
    console.error("Supabase Error (getScores):", error);
    return [];
  }
  return data || [];
}

export async function submitScores(score: ScoreRecord): Promise<void> {
  const { error } = await supabase.from("pals_scores").upsert({
    teamId: score.teamId,
    judgeId: score.judgeId,
    scores: score.scores,
    totalScore: score.totalScore,
    submittedAt: score.submittedAt,
    judgeSignOff: score.judgeSignOff
  }, { onConflict: 'teamId,judgeId' });
  
  if (error) throw error;
}

// Leaderboard calculations
export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  averageScore: number;
  judgeSubmissions: {
    judgeId: string;
    judgeName: string;
    totalScore: number;
  }[];
}

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
  await supabase.from("pals_scores").delete().neq("teamId", "impossible");
  await supabase.from("pals_teams").delete().neq("id", "impossible");
  await supabase.from("pals_judges").delete().neq("id", "impossible");
}
