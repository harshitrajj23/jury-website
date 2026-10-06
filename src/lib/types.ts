export interface Judge {
  id: string;
  username: string; // maps to email or username
  email?: string;
  name: string;
  designation: string;
  password?: string;
  passwordHash?: string;
  role?: string;
  completed?: boolean;
}

export interface Team {
  id: string;
  name: string; // maps to teamName
  teamName?: string;
  projectName?: string;
  teamCode?: string;
  tableNumber?: number;
  members?: string;
}

export interface ScoringCriteria {
  id: string;
  name: string;
  description?: string;
  maxScore?: number;
  weight?: number;
  orderIndex?: number;
  active?: boolean;
}

export interface JudgeSignOff {
  name: string;
  designation: string;
  date: string;
}

export interface ScoreRecord {
  teamId: string;
  judgeId: string;
  scores: Record<string, number>; // Mapping criteria.id -> score
  totalScore: number;
  weightedScore?: number;
  submittedAt: string;
  judgeSignOff?: JudgeSignOff;
}

export interface AppConfig {
  announceResults: boolean;
  criteriaList: ScoringCriteria[];
  timerDuration: number; // in seconds
  disqualifiedTeams?: string[];
  judgingOpen?: boolean;
  finaleReady?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  projectName?: string;
  averageScore: number; // weighted average score
  rawAverageScore?: number; // unweighted average score
  judgeSubmissions: {
    judgeId: string;
    judgeName: string;
    totalScore: number;
    weightedScore?: number;
  }[];
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}
