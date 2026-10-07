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
  eventId?: string;
}

export interface Team {
  id: string;
  name: string; // maps to teamName
  teamName?: string;
  projectName?: string;
  teamCode?: string;
  tableNumber?: number;
  members?: string;
  eventId?: string;
}

export interface ScoringCriteria {
  id: string;
  name: string;
  description?: string;
  maxScore?: number;
  weight?: number;
  orderIndex?: number;
  active?: boolean;
  eventId?: string;
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
  eventId?: string;
}

export interface EventItem {
  id: string;
  name: string;
  subtitle?: string;
  organizer?: string;
  logo?: string;
  organizerLogo?: string;
  banner?: string;
  date?: string;
  theme?: string;
  status?: string;
  timerDuration: number; // in seconds
  judgingOpen: boolean;
  leaderboardUnlocked: boolean;
  resultsDeclared?: boolean;
  declaredAt?: string;
  resultsPublished?: boolean;
  resultsPublishedAt?: string;
  finaleReady?: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppConfig {
  announceResults: boolean;
  resultsDeclared?: boolean;
  declaredAt?: string;
  resultsPublished?: boolean;
  resultsPublishedAt?: string;
  criteriaList: ScoringCriteria[];
  timerDuration: number; // in seconds
  disqualifiedTeams?: string[];
  judgingOpen?: boolean;
  finaleReady?: boolean;
  eventId?: string;
  event?: EventItem;
}

export interface LeaderboardEntry {
  rank: number;
  displayRank?: string; // e.g. "1", "2", "TIED 2ND"
  isTie?: boolean;
  tieLabel?: string;
  teamId: string;
  teamName: string;
  projectName?: string;
  tableNumber?: number;
  averageScore: number; // weighted average score (displayed rounded)
  rawWeightedScore: number; // FULL UNROUNDED weighted score for primary ranking
  rawAverageScore: number; // unweighted average score for secondary tiebreaker
  perfectTensCount: number; // third tiebreaker: count of 10s
  ninesCount: number; // fourth tiebreaker: count of 9s
  judgeSubmissions: {
    judgeId: string;
    judgeName: string;
    totalScore: number;
    weightedScore?: number;
  }[];
  eventId?: string;
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
  eventId?: string;
}
