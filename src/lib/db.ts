import { Judge, Team, ScoringCriteria, ScoreRecord, AppConfig } from "./types";

const KEYS = {
  JUDGES: "pals_judges",
  TEAMS: "pals_teams",
  SCORES: "pals_scores",
  CONFIG: "pals_config",
};

const DEFAULT_CRITERIA: ScoringCriteria[] = [
  { id: "c1", name: "Innovation & Creativity" },
  { id: "c2", name: "Technical Implementation" },
  { id: "c3", name: "Problem Solving" },
  { id: "c4", name: "User Experience" },
  { id: "c5", name: "Feasibility & Scalability" },
  { id: "c6", name: "Presentation Skills" },
  { id: "c7", name: "Effort & Skill" },
  { id: "c8", name: "Time Management" },
  { id: "c9", name: "Learning & Adaptability" },
  { id: "c10", name: "Impact" },
];

const DEFAULT_JUDGES: Judge[] = [];

const DEFAULT_TEAMS: Team[] = [];

// Helper to check environment
const isClient = () => typeof window !== "undefined";

// Delay simulator to mimic network latency
const delay = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

function getFromStorage<T>(key: string, defaultValue: T): T {
  if (!isClient()) return defaultValue;
  const value = localStorage.getItem(key);
  if (!value) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (!isClient()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

// Initializing store with defaults if empty
export const initDatabase = () => {
  if (!isClient()) return;
  if (!localStorage.getItem(KEYS.JUDGES)) {
    saveToStorage(KEYS.JUDGES, DEFAULT_JUDGES);
  }
  if (!localStorage.getItem(KEYS.TEAMS)) {
    saveToStorage(KEYS.TEAMS, DEFAULT_TEAMS);
  }
  if (!localStorage.getItem(KEYS.CONFIG)) {
    const config: AppConfig = {
      announceResults: false,
      criteriaList: DEFAULT_CRITERIA,
      timerDuration: 480, // Default 8 minutes in seconds
    };
    saveToStorage(KEYS.CONFIG, config);
  }
  if (!localStorage.getItem(KEYS.SCORES)) {
    saveToStorage(KEYS.SCORES, [] as ScoreRecord[]);
  }
};

// JUDGES
export async function getJudges(): Promise<Judge[]> {
  await delay(150);
  initDatabase();
  return getFromStorage<Judge[]>(KEYS.JUDGES, DEFAULT_JUDGES);
}

export async function addJudge(judge: Omit<Judge, "id">): Promise<Judge> {
  await delay(150);
  const judges = await getJudges();
  const newJudge: Judge = {
    ...judge,
    id: `j_${Date.now()}`,
  };
  judges.push(newJudge);
  saveToStorage(KEYS.JUDGES, judges);
  return newJudge;
}

export async function removeJudge(id: string): Promise<void> {
  await delay(150);
  const judges = await getJudges();
  const filtered = judges.filter((j) => j.id !== id);
  saveToStorage(KEYS.JUDGES, filtered);
  
  // Clean up scores submitted by this judge
  const scores = await getScores();
  const filteredScores = scores.filter((s) => s.judgeId !== id);
  saveToStorage(KEYS.SCORES, filteredScores);
}

// TEAMS
export async function getTeams(): Promise<Team[]> {
  await delay(150);
  initDatabase();
  return getFromStorage<Team[]>(KEYS.TEAMS, DEFAULT_TEAMS);
}

export async function addTeam(name: string): Promise<Team> {
  await delay(150);
  const teams = await getTeams();
  const newTeam: Team = {
    id: `t_${Date.now()}`,
    name,
  };
  teams.push(newTeam);
  saveToStorage(KEYS.TEAMS, teams);
  return newTeam;
}

export async function removeTeam(id: string): Promise<void> {
  await delay(150);
  const teams = await getTeams();
  const filtered = teams.filter((t) => t.id !== id);
  saveToStorage(KEYS.TEAMS, filtered);

  // Clean up scores related to this team
  const scores = await getScores();
  const filteredScores = scores.filter((s) => s.teamId !== id);
  saveToStorage(KEYS.SCORES, filteredScores);
}

// CONFIG & CRITERIA
export async function getConfig(): Promise<AppConfig> {
  await delay(150);
  initDatabase();
  const config = getFromStorage<AppConfig>(KEYS.CONFIG, {
    announceResults: false,
    criteriaList: DEFAULT_CRITERIA,
    timerDuration: 480,
  });
  if (config.timerDuration === undefined) {
    config.timerDuration = 480;
  }
  return config;
}

export async function updateTimerDuration(durationSeconds: number): Promise<void> {
  const config = await getConfig();
  config.timerDuration = durationSeconds;
  await updateConfig(config);
}

export async function updateConfig(config: AppConfig): Promise<void> {
  await delay(150);
  saveToStorage(KEYS.CONFIG, config);
}

export async function toggleAnnounceResults(announce: boolean): Promise<void> {
  const config = await getConfig();
  config.announceResults = announce;
  await updateConfig(config);
}

export async function updateCriteria(criteriaList: ScoringCriteria[]): Promise<void> {
  const config = await getConfig();
  config.criteriaList = criteriaList;
  await updateConfig(config);
}

// SCORES & EVALUATIONS
export async function getScores(): Promise<ScoreRecord[]> {
  await delay(200);
  initDatabase();
  return getFromStorage<ScoreRecord[]>(KEYS.SCORES, []);
}

export async function submitScores(score: ScoreRecord): Promise<void> {
  await delay(250);
  const scores = await getScores();
  
  // Prevent duplicate submissions for same team by same judge
  const index = scores.findIndex(
    (s) => s.teamId === score.teamId && s.judgeId === score.judgeId
  );
  
  if (index !== -1) {
    scores[index] = score; // Update existing
  } else {
    scores.push(score); // Add new
  }
  
  saveToStorage(KEYS.SCORES, scores);
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
  const teams = await getTeams();
  const judges = await getJudges();
  const scores = await getScores();
  
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
  
  // Sort descending by average score
  const sorted = entries.sort((a, b) => b.averageScore - a.averageScore);
  
  // Assign ranks
  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

// Database Reset
export async function resetDatabase(): Promise<void> {
  await delay(300);
  if (isClient()) {
    localStorage.removeItem(KEYS.JUDGES);
    localStorage.removeItem(KEYS.TEAMS);
    localStorage.removeItem(KEYS.SCORES);
    localStorage.removeItem(KEYS.CONFIG);
    initDatabase();
  }
}
