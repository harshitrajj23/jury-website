export interface Judge {
  id: string;
  username: string;
  name: string;
  designation: string;
  password?: string; // Credentials stored securely
}

export interface Team {
  id: string;
  name: string;
}

export interface ScoringCriteria {
  id: string;
  name: string;
}

export interface JudgeSignOff {
  name: string;
  designation: string;
  date: string;
}

export interface ScoreRecord {
  teamId: string;
  judgeId: string;
  scores: Record<string, number>; // Mapping criteria.id -> score (1-10)
  totalScore: number; // calculated max 100
  submittedAt: string;
  judgeSignOff: JudgeSignOff;
}

export interface AppConfig {
  announceResults: boolean;
  criteriaList: ScoringCriteria[];
  timerDuration: number; // in seconds
  disqualifiedTeams?: string[];
}

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
