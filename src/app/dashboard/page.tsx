"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  LogOut, 
  Lock, 
  ShieldCheck, 
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  RefreshCw,
  Layers,
  Search,
  ArrowLeft,
  X,
  Award,
  Building2,
  Calendar
} from "lucide-react";
import { 
  getTeams, 
  getJudgeScores, 
  getConfig, 
  submitScores, 
  initDatabase,
  getEvents,
  getJudgePortalData
} from "@/lib/db";
import { Team, ScoringCriteria, ScoreRecord, Judge, EventItem } from "@/lib/types";
import { useRealtimeSync } from "@/lib/useRealtimeSync";
import CyberButton from "@/components/CyberButton";

export default function JudgeDashboardPage() {
  const router = useRouter();
  
  // Authentication & Session
  const [judge, setJudge] = useState<Judge | null>(null);
  
  // Events state
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("default_event");
  const [currentEvent, setCurrentEvent] = useState<EventItem | null>(null);

  // DB State
  const [teams, setTeams] = useState<Team[]>([]);
  const [criteria, setCriteria] = useState<ScoringCriteria[]>([]);
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [announceResults, setAnnounceResults] = useState(false);
  const [judgingOpen, setJudgingOpen] = useState(true);
  
  // Team Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "evaluated">("all");

  // Focused Team Evaluation State
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [evaluationScores, setEvaluationScores] = useState<Record<string, number>>({});
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  
  // Feedback Toasts
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  // UX States - Team-scoped submission to prevent cross-team contamination
  const [loading, setLoading] = useState(true);
  const [submittingTeamId, setSubmittingTeamId] = useState<string | null>(null);
  const isInitialLoadRef = useRef(true);
  const selectedTeamRef = useRef<Team | null>(null);
  const currentEventIdRef = useRef<string>("default_event");

  useEffect(() => {
    selectedTeamRef.current = selectedTeam;
  }, [selectedTeam]);

  useEffect(() => {
    currentEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };
  
  const fetchData = async (judgeId: string, eventId: string = selectedEventId, isBackground = false) => {
    if (!isBackground && isInitialLoadRef.current) {
      setLoading(true);
    }
    try {
      const portalRes = await getJudgePortalData(judgeId, eventId);
      if (!portalRes.success || !portalRes.data) {
        showFeedback("error", portalRes.error || "TRANSMISSION_ERROR: Could not load judge portal data.");
        setLoading(false);
        return;
      }

      const {
        authorizedEvents,
        selectedEventId: effectiveEventId,
        currentEvent: assignedEvent,
        teams: allTeams,
        judgeScores,
        criteriaList,
        judgingOpen: isJudgingOpen,
        announceResults: isAnnounceResults,
      } = portalRes.data;

      setEvents(authorizedEvents || []);
      setCurrentEvent(assignedEvent);
      setSelectedEventId(effectiveEventId);
      currentEventIdRef.current = effectiveEventId;

      setTeams(allTeams || []);
      setScores(judgeScores || []);
      setCriteria(criteriaList || []);
      setAnnounceResults(isAnnounceResults);
      setJudgingOpen(isJudgingOpen);

      // If a team is actively open and still exists in this event, keep it synced;
      // otherwise maintain selectedTeam as null so judge remains on search screen
      if (selectedTeamRef.current) {
        const stillValid = allTeams.find((t) => t.id === selectedTeamRef.current?.id);
        if (stillValid) {
          setSelectedTeam(stillValid);
        } else {
          setSelectedTeam(null);
        }
      }
      isInitialLoadRef.current = false;
    } catch (err) {
      console.error("Transmission error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Route security & mount initializers
  useEffect(() => {
    initDatabase();
    
    const session = sessionStorage.getItem("judge_session");
    if (!session) {
      router.push("/");
      return;
    }
    
    try {
      const parsedJudge = JSON.parse(session) as Judge;
      setJudge(parsedJudge);
      const initialEventId = parsedJudge.eventId || "default_event";
      setSelectedEventId(initialEventId);
      currentEventIdRef.current = initialEventId;
      fetchData(parsedJudge.id, initialEventId, false);
    } catch (e) {
      router.push("/");
    }
  }, [router]);

  // Realtime sync scoped to current eventId
  const handleRealtimeChange = useCallback(() => {
    if (judge) {
      fetchData(judge.id, currentEventIdRef.current, true);
    }
  }, [judge]);

  const realtimeStatus = useRealtimeSync({
    tables: ["Score", "Team", "Settings", "Criteria", "Event"],
    eventId: selectedEventId,
    onDataChange: handleRealtimeChange,
    enabled: !!judge,
    intervalMs: 20000,
  });

  const handleSelectTeam = (
    team: Team, 
    allScores: ScoreRecord[], 
    activeCriteria: ScoringCriteria[],
    judgeId: string
  ) => {
    // Prevent switching while current team evaluation is in flight
    if (submittingTeamId) return;

    setSelectedTeam(team);
    setInputErrors({});
    
    // Check if score record already exists for this team by this judge
    const matchedRecord = allScores.find(
      (s) => s.teamId === team.id && s.judgeId === judgeId
    );
    
    const rawScores: Record<string, number> = {};
    const strInputs: Record<string, string> = {};

    if (matchedRecord) {
      activeCriteria.forEach((c) => {
        const val = matchedRecord.scores[c.id] ?? 5;
        rawScores[c.id] = val;
        strInputs[c.id] = String(val);
      });
    } else {
      // Default to mid-range score (5) for all active criteria
      activeCriteria.forEach((c) => {
        rawScores[c.id] = 5;
        strInputs[c.id] = "5";
      });
    }

    setEvaluationScores(rawScores);
    setScoreInputs(strInputs);
  };

  const handleEventChange = (newEvId: string) => {
    if (submittingTeamId) return;
    setSelectedEventId(newEvId);
    currentEventIdRef.current = newEvId;
    setSelectedTeam(null);
    setInputErrors({});
    setSearchQuery(""); // Clear search state when switching events
    setStatusFilter("all");
    if (judge) {
      fetchData(judge.id, newEvId, false);
    }
  };

  // Strict integer 1-10 validation handler
  const handleScoreInputChange = (criteriaId: string, rawStr: string) => {
    setScoreInputs((prev) => ({ ...prev, [criteriaId]: rawStr }));

    const trimmed = rawStr.trim();
    if (trimmed === "") {
      setInputErrors((prev) => ({ ...prev, [criteriaId]: "Score is required (1–10)" }));
      return;
    }

    // Check if non-integer / decimal
    if (!/^-?\d+$/.test(trimmed)) {
      setInputErrors((prev) => ({ ...prev, [criteriaId]: "Only whole integers allowed (no decimals)" }));
      return;
    }

    const num = parseInt(trimmed, 10);
    if (isNaN(num)) {
      setInputErrors((prev) => ({ ...prev, [criteriaId]: "Invalid numeric score" }));
      return;
    }

    if (num < 1) {
      setInputErrors((prev) => ({ ...prev, [criteriaId]: "Minimum score is 1" }));
      return;
    }

    if (num > 10) {
      setInputErrors((prev) => ({ ...prev, [criteriaId]: "Maximum score is 10" }));
      return;
    }

    // Valid integer 1-10
    setInputErrors((prev) => {
      const copy = { ...prev };
      delete copy[criteriaId];
      return copy;
    });

    setEvaluationScores((prev) => ({
      ...prev,
      [criteriaId]: num,
    }));
  };

  const handleStepScore = (criteriaId: string, delta: number) => {
    const current = evaluationScores[criteriaId] ?? 5;
    const next = Math.max(1, Math.min(10, current + delta));
    setScoreInputs((prev) => ({ ...prev, [criteriaId]: String(next) }));
    setInputErrors((prev) => {
      const copy = { ...prev };
      delete copy[criteriaId];
      return copy;
    });
    setEvaluationScores((prev) => ({
      ...prev,
      [criteriaId]: next,
    }));
  };

  const handleLogout = () => {
    sessionStorage.removeItem("judge_session");
    router.push("/");
  };

  // Find if currently selected team is locked for this judge
  const currentRecord = selectedTeam && judge
    ? scores.find((s) => s.teamId === selectedTeam.id && s.judgeId === judge.id)
    : null;

  const isCurrentTeamLocked = !!currentRecord;
  const isTeamDisqualified = selectedTeam?.name.startsWith("[DISQUALIFIED]");
  const isSubmittingCurrentTeam = submittingTeamId === selectedTeam?.id;

  // Calculate live sum
  const calculateTotal = () => {
    return Object.values(evaluationScores).reduce((sum, score) => sum + (Number(score) || 0), 0);
  };

  // Submit evaluation with multi-click protection, timeout recovery & atomic batch execution
  const handleFinalSubmit = async () => {
    if (!selectedTeam || !judge || submittingTeamId) return;
    
    if (!judgingOpen) {
      showFeedback("error", "JUDGING_LOCKED: Judging is currently paused by the administrator.");
      return;
    }

    if (isTeamDisqualified) {
      showFeedback("error", "EVALUATION_DENIED: Disqualified teams cannot receive scores.");
      return;
    }

    // 1. Validate all active criteria are scored with integers 1-10
    const newErrors: Record<string, string> = {};
    for (const c of criteria) {
      const rawInput = (scoreInputs[c.id] ?? "").trim();
      const val = evaluationScores[c.id];

      if (rawInput === "" || val === undefined || val === null) {
        newErrors[c.id] = "Score is required (1–10)";
        continue;
      }

      if (!Number.isInteger(val) || val < 1 || val > 10) {
        newErrors[c.id] = "Must be integer between 1 and 10";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setInputErrors(newErrors);
      showFeedback("error", "VALIDATION_ERROR: Please enter valid integer marks (1–10) for all criteria.");
      return;
    }

    // Lock submission specifically to this team
    const teamToSubmit = selectedTeam;
    setSubmittingTeamId(teamToSubmit.id);
    
    const record: ScoreRecord = {
      teamId: teamToSubmit.id,
      judgeId: judge.id,
      scores: evaluationScores,
      totalScore: calculateTotal(),
      submittedAt: new Date().toISOString(),
      eventId: selectedEventId,
      judgeSignOff: {
        name: judge.name,
        designation: judge.designation,
        date: new Date().toISOString()
      }
    };

    try {
      // 8-second safety timeout protection against infinite hanging
      const timeoutPromise = new Promise<{ success: boolean; error?: string }>((_, reject) =>
        setTimeout(() => reject(new Error("NETWORK_TIMEOUT: Submission took longer than 8 seconds. Please verify connection and retry.")), 8000)
      );

      const res = await Promise.race([submitScores(record, selectedEventId), timeoutPromise]);

      if (!res.success) {
        showFeedback("error", res.error || "TRANSMISSION_ERROR: Score submission rejected.");
        setSubmittingTeamId(null);
        return;
      }
      
      // Optimistically update local scores immediately so lock banner appears without waiting
      setScores((prev) => {
        const filtered = prev.filter((s) => !(s.teamId === teamToSubmit.id && s.judgeId === judge.id));
        return [...filtered, record];
      });

      // Close evaluation view and return immediately to the Team Search screen!
      setSelectedTeam(null);
      setInputErrors({});
      setScoreInputs({});
      setEvaluationScores({});

      showFeedback("success", `✅ EVALUATION ENCRYPTED & SUBMITTED FOR ${teamToSubmit.name.toUpperCase()}`);
      
      // Background refetch to ensure complete DB synchronization
      getJudgeScores(judge.id, selectedEventId).then((updatedScores) => {
        setScores(updatedScores);
      }).catch(console.error);

    } catch (err: any) {
      showFeedback("error", `FAIL: ${err?.message || "Score submission timed out or failed"}`);
    } finally {
      setSubmittingTeamId(null);
    }
  };

  // Check which teams are completed by this judge
  const isTeamCompleted = (teamId: string) => {
    return scores.some((s) => s.teamId === teamId && s.judgeId === judge?.id);
  };

  // Filter teams strictly to the active event
  const eventTeams = teams.filter((t) => !t.eventId || t.eventId === selectedEventId);
  const completedCount = eventTeams.filter((t) => isTeamCompleted(t.id)).length;
  const pendingCount = eventTeams.length - completedCount;

  // Search filter
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = eventTeams.filter((t) => {
    const isCompleted = isTeamCompleted(t.id);
    if (statusFilter === "pending" && isCompleted) return false;
    if (statusFilter === "evaluated" && !isCompleted) return false;

    if (!normalizedQuery) return true;
    const nameMatch = t.name.toLowerCase().includes(normalizedQuery);
    const projMatch = t.projectName ? t.projectName.toLowerCase().includes(normalizedQuery) : false;
    const codeMatch = t.teamCode ? t.teamCode.toLowerCase().includes(normalizedQuery) : false;
    return nameMatch || projMatch || codeMatch;
  });

  if (loading || !judge) {
    return (
      <div className="min-h-screen bg-cyber-bg flex justify-center items-center font-mono text-cyber-cyan p-4">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-10 h-10 animate-spin text-cyber-cyan" />
          <p className="font-orbitron tracking-widest text-sm uppercase text-center">LOADING SECURE JURY ENVIRONMENT...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative pb-12 overflow-x-hidden">
      {/* Ambient Event Banner Glow */}
      {currentEvent?.banner && (
        <div
          className="fixed inset-0 bg-cover bg-center opacity-5 filter blur-sm pointer-events-none z-0"
          style={{ backgroundImage: `url(${currentEvent.banner})` }}
        />
      )}

      {/* Dynamic Utility Header */}
      <header className="border-b border-cyber-cyan/15 bg-cyber-bg-darker/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-row items-center justify-between gap-3">
          
          {/* Left: Judge Session & Status Indicator */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${realtimeStatus === "connected" ? "bg-cyber-green animate-ping" : "bg-cyber-yellow"}`} />
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span className="font-orbitron font-bold text-xs sm:text-sm text-white tracking-wider uppercase truncate">
                JURY EVALUATOR: {judge.name.toUpperCase()}
              </span>
              <span className="text-[10px] font-mono text-gray-500 hidden sm:inline">•</span>
              <span className="font-mono text-[10px] text-cyber-cyan tracking-wider truncate">
                [{completedCount}/{eventTeams.length} EVALUATED]
              </span>
              {realtimeStatus === "connected" && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 bg-cyber-green/10 border border-cyber-green/30 text-cyber-green uppercase font-semibold hidden md:inline">
                  ⚡ LIVE SYNC
                </span>
              )}
            </div>
          </div>

          {/* Right: Event Switcher / Event Badge & Disconnect */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Event Selector: ONLY shown if judge is authorized for multiple events */}
            {events.length > 1 ? (
              <div className="flex items-center gap-1.5 bg-cyber-bg-darker border border-cyber-cyan/30 px-2.5 py-1 text-xs font-mono">
                <Layers className="w-3.5 h-3.5 text-cyber-cyan shrink-0" />
                <label htmlFor="dashboard-event-select" className="text-[10px] text-gray-400 font-bold uppercase hidden sm:inline">
                  EVENT:
                </label>
                <select
                  id="dashboard-event-select"
                  aria-label="Select Evaluation Event"
                  value={selectedEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  disabled={!!submittingTeamId}
                  className="bg-transparent text-cyber-cyan font-bold outline-none cursor-pointer pr-1 text-xs max-w-[140px] sm:max-w-[200px] truncate"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-gray-900 text-white">
                      {ev.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              /* Single Event Badge: Clean display without unnecessary dropdown */
              <div className="hidden sm:flex items-center gap-1.5 bg-cyber-bg-darker/80 border border-gray-800 px-2.5 py-1 text-xs font-mono">
                <span className="text-[9px] text-gray-500 uppercase font-bold">ASSIGNED:</span>
                <span className="text-gray-200 font-bold truncate max-w-[170px]">
                  {currentEvent?.name || selectedEventId}
                </span>
              </div>
            )}

            <CyberButton
              variant="red"
              size="sm"
              onClick={handleLogout}
              disabled={!!submittingTeamId}
              className="flex items-center gap-1.5 shrink-0 text-xs"
            >
              <LogOut className="w-3.5 h-3.5" /> DISCONNECT
            </CyberButton>
          </div>
        </div>
      </header>

      {/* Floating Feedback Banner */}
      {feedback && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 w-full">
          <div className={`p-3.5 font-mono text-xs flex items-center gap-3 border shadow-lg transition-all duration-300 ${
            feedback.type === "success"
              ? "bg-cyber-green/15 border-cyber-green/40 text-cyber-green"
              : "bg-cyber-red/15 border-cyber-red/40 text-cyber-red"
          }`}>
            {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            <span className="font-bold">{feedback.message}</span>
          </div>
        </div>
      )}

      {/* Judging Paused Notice */}
      {!judgingOpen && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 w-full">
          <div className="p-3 bg-cyber-yellow/15 border border-cyber-yellow/40 text-cyber-yellow font-mono text-xs flex items-center gap-3">
            <AlertOctagon className="w-4 h-4 shrink-0 animate-pulse" />
            <span>⚡ NOTICE: Judging evaluation is currently paused for this event. Submissions are temporarily frozen.</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 flex-grow flex flex-col gap-6 w-full">
        
        {/* ============================================================== */}
        {/* VIEW A: SEARCH & SELECT TEAM WORKFLOW (DEFAULT SCREEN)         */}
        {/* ============================================================== */}
        {!selectedTeam ? (
          <div className="flex flex-col gap-6 w-full">
            {/* ============================================================== */}
            {/* DEDICATED EVENT-SPECIFIC JUDGE PORTAL BRANDING BANNER          */}
            {/* ============================================================== */}
            <div className="w-full cyber-glass border border-cyber-cyan/35 p-5 sm:p-6 relative overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.12)]">
              {currentEvent?.banner && (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-15 filter blur-[1px] pointer-events-none"
                    style={{ backgroundImage: `url(${currentEvent.banner})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-cyber-bg-darker via-cyber-bg-darker/85 to-transparent pointer-events-none" />
                </>
              )}

              {/* Cyberpunk Corner Markers */}
              <span className="absolute top-0 left-0 w-2.5 h-2.5 bg-cyber-cyan" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-cyber-cyan" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-cyber-cyan/30" />
              <span className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-cyber-cyan/30" />

              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                {/* Left Side: Event Logo + Hierarchy (Name -> Organizer -> Subtitle/Date) */}
                <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0 flex-grow">
                  {/* 1. Event Logo or High-Fidelity Fallback */}
                  <div className="shrink-0 mt-0.5 sm:mt-0">
                    {currentEvent?.logo ? (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 p-1.5 bg-black/75 border border-cyber-cyan/50 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentEvent.logo}
                          alt={currentEvent.name}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-cyber-cyan/10 border border-cyber-cyan/40 flex items-center justify-center text-cyber-cyan shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                        <Award className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* 2. Primary Event Typography Hierarchy */}
                  <div className="min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono uppercase px-2 py-0.5 bg-cyber-cyan/20 border border-cyber-cyan/40 text-cyber-cyan font-bold tracking-widest">
                        EVALUATION EVENT
                      </span>
                      {currentEvent?.date && (
                        <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-cyber-cyan/70" />
                          {currentEvent.date}
                        </span>
                      )}
                    </div>

                    {/* Event Name */}
                    <h1 className="font-orbitron font-extrabold text-lg sm:text-2xl md:text-3xl text-white tracking-wider uppercase text-glow-cyan drop-shadow leading-tight break-words">
                      {currentEvent?.name || selectedEventId}
                    </h1>

                    {/* Organizer / Club Name */}
                    {currentEvent?.organizer && (
                      <p className="font-mono text-xs sm:text-sm text-cyber-cyan font-semibold tracking-wide flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-cyber-cyan shrink-0" />
                        {currentEvent.organizer}
                      </p>
                    )}

                    {/* Subtitle / Description */}
                    {currentEvent?.subtitle && (
                      <p className="font-mono text-[11px] sm:text-xs text-gray-400 tracking-wide line-clamp-2">
                        {currentEvent.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Side: Organizer / Club Logo */}
                {currentEvent?.organizerLogo && (
                  <div className="shrink-0 self-end sm:self-center flex flex-col items-end gap-1">
                    <span className="text-[8px] font-mono text-gray-400 uppercase tracking-widest hidden sm:block">
                      ORGANIZER
                    </span>
                    <div className="p-1.5 bg-black/75 border border-gray-700/80 flex items-center justify-center max-w-[130px] max-h-14 sm:max-h-16 shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentEvent.organizerLogo}
                        alt={currentEvent.organizer || "Organizer"}
                        className="max-w-full max-h-10 sm:max-h-12 object-contain"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Search Header Card */}
            <div className="cyber-glass border border-cyber-cyan/30 p-5 sm:p-6 flex flex-col gap-4 shadow-[0_0_20px_rgba(6,182,212,0.06)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyber-cyan/15 pb-3">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-cyber-cyan" />
                  <h2 className="font-orbitron text-sm sm:text-base font-bold text-white tracking-wider uppercase">
                    SEARCH TEAM FOR EVALUATION
                  </h2>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-gray-400 uppercase">STATUS:</span>
                  <span className="text-cyber-green font-bold">{completedCount} EVALUATED</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-cyber-yellow">{pendingCount} PENDING</span>
                </div>
              </div>

              {/* Search Bar Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-cyber-cyan/60" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search team name (e.g. Team Alpha), project, or code..."
                  className="w-full bg-cyber-bg-darker/90 text-white placeholder-gray-500 font-mono text-sm sm:text-base pl-10 pr-10 py-3 border border-cyber-cyan/40 focus:border-cyber-cyan focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] outline-none transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white font-mono text-xs cursor-pointer"
                    aria-label="Clear search query"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">VIEW:</span>
                {[
                  { id: "all", label: `ALL TEAMS (${eventTeams.length})` },
                  { id: "pending", label: `PENDING (${pendingCount})` },
                  { id: "evaluated", label: `EVALUATED (${completedCount})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id as any)}
                    className={`px-3 py-1 text-xs font-mono border transition-all cursor-pointer ${
                      statusFilter === f.id
                        ? "border-cyber-cyan bg-cyber-cyan/20 text-white font-bold shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                        : "border-gray-800 bg-cyber-bg-darker/60 hover:border-gray-700 text-gray-400"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Results List */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="font-mono text-xs text-gray-400 uppercase tracking-wider">
                  {searchResults.length === 1 ? "1 TEAM FOUND" : `${searchResults.length} TEAMS FOUND`}
                  {searchQuery && ` MATCHING "${searchQuery}"`}
                </span>
                <span className="font-mono text-[10px] text-gray-500">
                  EVENT: {currentEvent?.name || selectedEventId}
                </span>
              </div>

              {searchResults.length === 0 ? (
                <div className="cyber-glass border border-cyber-cyan/15 p-12 text-center flex flex-col items-center justify-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-cyber-yellow" />
                  <p className="font-orbitron text-sm text-gray-300 uppercase tracking-wider font-bold">
                    NO TEAMS FOUND
                  </p>
                  <p className="text-xs text-gray-500 font-mono max-w-md">
                    {searchQuery
                      ? `No teams in "${currentEvent?.name || "this event"}" match "${searchQuery}". Check spelling or try a partial search keyword.`
                      : `No teams matching filter "${statusFilter.toUpperCase()}" in this event.`}
                  </p>
                  {searchQuery && (
                    <CyberButton
                      variant="cyan"
                      size="sm"
                      onClick={() => setSearchQuery("")}
                      className="mt-2"
                    >
                      CLEAR SEARCH
                    </CyberButton>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((t) => {
                    const completed = isTeamCompleted(t.id);
                    const isDq = t.name.startsWith("[DISQUALIFIED]");
                    const existingRecord = scores.find((s) => s.teamId === t.id && s.judgeId === judge.id);

                    return (
                      <div
                        key={t.id}
                        className={`p-5 border transition-all duration-200 flex flex-col justify-between gap-4 cyber-glass ${
                          completed
                            ? "border-cyber-green/40 bg-cyber-green/5 shadow-[0_0_15px_rgba(34,197,94,0.06)]"
                            : isDq
                            ? "border-cyber-red/30 bg-cyber-red/5"
                            : "border-cyber-cyan/25 bg-cyber-bg-darker/60 hover:border-cyber-cyan/60 hover:shadow-[0_0_15px_rgba(6,182,212,0.12)]"
                        }`}
                      >
                        {/* Top: Status Badges + Metadata */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-grow">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              {completed ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyber-green bg-cyber-green/15 border border-cyber-green/40 px-2 py-0.5 font-bold uppercase tracking-wider">
                                  <CheckCircle2 className="w-3 h-3" /> EVALUATED
                                </span>
                              ) : isDq ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyber-red bg-cyber-red/15 border border-cyber-red/40 px-2 py-0.5 font-bold uppercase tracking-wider">
                                  <AlertOctagon className="w-3 h-3" /> DISQUALIFIED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyber-yellow bg-cyber-yellow/15 border border-cyber-yellow/40 px-2 py-0.5 font-bold uppercase tracking-wider">
                                  NOT EVALUATED
                                </span>
                              )}

                              {t.teamCode && (
                                <span className="text-[10px] font-mono text-gray-400 bg-black/40 border border-gray-800 px-1.5 py-0.5">
                                  {t.teamCode}
                                </span>
                              )}

                              {t.tableNumber !== undefined && (
                                <span className="text-[10px] font-mono text-gray-500">
                                  Table {t.tableNumber}
                                </span>
                              )}
                            </div>

                            <h3 className={`font-orbitron font-extrabold text-base sm:text-lg text-white uppercase tracking-wide truncate ${isDq ? "line-through text-cyber-red" : ""}`}>
                              {t.name}
                            </h3>

                            {t.projectName && t.projectName !== t.name && (
                              <p className="text-xs text-gray-400 font-mono mt-1 line-clamp-2">
                                Project: {t.projectName}
                              </p>
                            )}

                            {t.members && (
                              <p className="text-[11px] text-gray-500 font-sans mt-1 truncate">
                                Members: {t.members}
                              </p>
                            )}
                          </div>

                          {completed && existingRecord && (
                            <div className="text-right shrink-0">
                              <span className="text-[9px] font-mono text-gray-500 uppercase block">YOUR MARKS</span>
                              <span className="font-orbitron font-extrabold text-lg text-cyber-green">
                                {existingRecord.totalScore}
                                <span className="text-[10px] text-gray-500 font-normal">/{criteria.length * 10}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Bottom: OPEN / VIEW Button */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
                          <span className="text-[10px] font-mono text-gray-500 truncate">
                            ID: {t.id}
                          </span>

                          <CyberButton
                            variant={completed ? "green" : "cyan"}
                            size="sm"
                            onClick={() => handleSelectTeam(t, scores, criteria, judge.id)}
                            className="flex items-center gap-1.5 px-4 font-bold"
                          >
                            {completed ? "VIEW EVALUATION" : "OPEN EVALUATION"}
                          </CyberButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* VIEW B: FOCUSED TEAM EVALUATION VIEW                           */
          /* ============================================================== */
          <div className="flex flex-col gap-5 w-full">
            {/* Top Navigation & Compact Event Identity Bar */}
            <div className="w-full bg-cyber-bg-darker/95 border border-cyber-cyan/30 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_15px_rgba(6,182,212,0.08)]">
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                disabled={isSubmittingCurrentTeam}
                className="flex items-center gap-2 text-xs font-mono text-cyber-cyan hover:text-white transition-colors cursor-pointer border border-cyber-cyan/40 bg-black/50 px-3.5 py-2 disabled:opacity-50 shrink-0 w-fit"
              >
                <ArrowLeft className="w-4 h-4" /> ← BACK TO TEAM SEARCH
              </button>

              {/* Compact Event Identity in Evaluation Screen */}
              <div className="flex items-center gap-3 min-w-0">
                {currentEvent?.logo ? (
                  <div className="w-9 h-9 p-1 bg-black/70 border border-cyber-cyan/40 shrink-0 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentEvent.logo} alt="" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-9 h-9 bg-cyber-cyan/10 border border-cyber-cyan/30 shrink-0 flex items-center justify-center text-cyber-cyan">
                    <Award className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="font-orbitron font-bold text-xs sm:text-sm text-white uppercase tracking-wider truncate">
                    {currentEvent?.name || selectedEventId}
                  </h2>
                  {currentEvent?.organizer && (
                    <p className="font-mono text-[10px] sm:text-xs text-cyber-cyan font-semibold truncate flex items-center gap-1">
                      <Building2 className="w-2.5 h-2.5 text-cyber-cyan" /> {currentEvent.organizer}
                    </p>
                  )}
                </div>

                {currentEvent?.organizerLogo && (
                  <div className="shrink-0 p-1 bg-black/70 border border-gray-800 max-h-9 hidden md:flex items-center justify-center ml-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentEvent.organizerLogo} alt="" className="max-h-7 max-w-[80px] object-contain" />
                  </div>
                )}
              </div>
            </div>

            {/* Team Evaluation Container */}
            <div className="cyber-glass border border-cyber-cyan/25 p-5 sm:p-6 flex flex-col gap-6 relative shadow-[0_0_25px_rgba(6,182,212,0.08)]">
              {/* Header details */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-cyber-cyan/15 pb-4">
                <div className="min-w-0 flex-grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-mono text-cyber-cyan uppercase tracking-widest bg-cyber-cyan/10 px-2 py-0.5 border border-cyber-cyan/20">
                      EVALUATION TARGET
                    </span>
                    {selectedTeam.teamCode && (
                      <span className="text-[9px] font-mono text-gray-400 bg-gray-900 border border-gray-800 px-1.5 py-0.5">
                        {selectedTeam.teamCode}
                      </span>
                    )}
                    {selectedTeam.tableNumber !== undefined && (
                      <span className="text-[9px] font-mono text-gray-400 bg-gray-900 border border-gray-800 px-1.5 py-0.5">
                        Table {selectedTeam.tableNumber}
                      </span>
                    )}
                  </div>
                  <h2 className="font-orbitron font-extrabold text-xl sm:text-2xl text-white tracking-wide mt-1.5 uppercase truncate">
                    {selectedTeam.name}
                  </h2>
                  {selectedTeam.projectName && selectedTeam.projectName !== selectedTeam.name && (
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      Project: {selectedTeam.projectName}
                    </p>
                  )}
                  {selectedTeam.members && (
                    <p className="text-[11px] text-gray-500 font-sans mt-0.5">
                      Members: {selectedTeam.members}
                    </p>
                  )}
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">
                    TOTAL RATING CARD
                  </span>
                  <span className={`font-orbitron font-extrabold text-2xl tracking-widest ${isCurrentTeamLocked ? "text-cyber-green text-glow-green" : "text-cyber-cyan text-glow-cyan"}`}>
                    {calculateTotal()}<span className="text-xs text-gray-500 font-normal">/{criteria.length * 10}</span>
                  </span>
                </div>
              </div>

              {/* Lock Warning banner */}
              {isCurrentTeamLocked && (
                <div className="bg-cyber-green/15 border border-cyber-green/30 p-3.5 flex items-start gap-3">
                  <Lock className="w-5 h-5 text-cyber-green mt-0.5 shrink-0 animate-pulse" />
                  <div className="flex flex-col gap-0.5 font-mono text-xs">
                    <span className="text-cyber-green font-bold uppercase tracking-wider">
                      🔒 SUBMISSION FINALIZED & ENCRYPTED
                    </span>
                    <p className="text-[11px] text-gray-400">
                      Scores locked as read-only at {currentRecord ? new Date(currentRecord.submittedAt).toLocaleTimeString() : "recorded time"}.
                      Sign-off verified under: {currentRecord?.judgeSignOff?.name || judge.name} ({currentRecord?.judgeSignOff?.designation || judge.designation}).
                    </p>
                  </div>
                </div>
              )}

              {/* Disqualified Warning */}
              {isTeamDisqualified && (
                <div className="bg-cyber-red/15 border border-cyber-red/30 p-3.5 flex items-start gap-3">
                  <AlertOctagon className="w-5 h-5 text-cyber-red mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-0.5 font-mono text-xs">
                    <span className="text-cyber-red font-bold uppercase tracking-wider">
                      ⚠️ TEAM DISQUALIFIED
                    </span>
                    <p className="text-[11px] text-gray-400">
                      This team has been disqualified from judging and will not be calculated in leaderboard aggregates.
                    </p>
                  </div>
                </div>
              )}

              {/* 1-10 Numeric Score Input Boxes */}
              <div className="flex flex-col gap-4 py-1">
                {criteria.map((c, index) => {
                  const scoreVal = evaluationScores[c.id] ?? 5;
                  const strVal = scoreInputs[c.id] !== undefined ? scoreInputs[c.id] : String(scoreVal);
                  const isLocked = isCurrentTeamLocked || isTeamDisqualified || !judgingOpen || isSubmittingCurrentTeam;
                  const errorMsg = inputErrors[c.id];

                  return (
                    <div 
                      key={c.id} 
                      className={`
                        p-4 border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3
                        ${errorMsg 
                          ? "border-cyber-red/60 bg-cyber-red/5" 
                          : isCurrentTeamLocked 
                          ? "border-gray-800 bg-cyber-bg-darker/25" 
                          : "border-cyber-cyan/15 bg-cyber-bg-darker/40 hover:border-cyber-cyan/35"
                        }
                      `}
                    >
                      {/* Left: Criteria Title & Description */}
                      <div className="flex-grow min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-orbitron text-xs sm:text-sm font-bold tracking-wider text-gray-100 uppercase">
                            {index + 1}. {c.name}
                          </span>
                          {c.weight && (
                            <span className="text-[10px] font-mono text-cyber-cyan/70 bg-cyber-cyan/10 px-1.5 py-0.2 border border-cyber-cyan/20">
                              Weight: {c.weight}
                            </span>
                          )}
                        </div>
                        {c.description && (
                          <p className="text-[11px] font-sans text-gray-400 mt-1 leading-snug">
                            {c.description}
                          </p>
                        )}
                        {errorMsg && (
                          <span className="text-[10px] font-mono text-cyber-red mt-1 block font-bold animate-pulse">
                            ⚠️ {errorMsg}
                          </span>
                        )}
                      </div>

                      {/* Right: Direct Numeric Input Box with Touch Steppers */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* Minus Button */}
                        <button
                          type="button"
                          aria-label={`Decrease score for ${c.name}`}
                          disabled={isLocked || scoreVal <= 1}
                          onClick={() => handleStepScore(c.id, -1)}
                          className="w-9 h-9 flex items-center justify-center border border-cyber-cyan/30 bg-cyber-bg-darker hover:bg-cyber-cyan/20 text-cyber-cyan disabled:opacity-25 disabled:cursor-not-allowed font-mono text-base font-bold transition-all active:scale-95"
                        >
                          -
                        </button>

                        {/* Numeric Input Box */}
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={2}
                            aria-label={`Enter score between 1 and 10 for ${c.name}`}
                            disabled={isLocked}
                            value={strVal}
                            onChange={(e) => handleScoreInputChange(c.id, e.target.value)}
                            className={`
                              w-16 h-10 text-center font-orbitron font-extrabold text-lg
                              bg-cyber-bg-darker/90 border transition-all duration-200 outline-none
                              ${errorMsg 
                                ? "border-cyber-red text-cyber-red shadow-[0_0_10px_rgba(244,63,94,0.4)]" 
                                : isCurrentTeamLocked 
                                ? "border-gray-700 text-cyber-green cursor-not-allowed"
                                : "border-cyber-cyan/50 text-white focus:border-cyber-cyan focus:shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                              }
                            `}
                          />
                        </div>

                        {/* Plus Button */}
                        <button
                          type="button"
                          aria-label={`Increase score for ${c.name}`}
                          disabled={isLocked || scoreVal >= 10}
                          onClick={() => handleStepScore(c.id, 1)}
                          className="w-9 h-9 flex items-center justify-center border border-cyber-cyan/30 bg-cyber-bg-darker hover:bg-cyber-cyan/20 text-cyber-cyan disabled:opacity-25 disabled:cursor-not-allowed font-mono text-base font-bold transition-all active:scale-95"
                        >
                          +
                        </button>

                        {/* Out of 10 Indicator */}
                        <span className="font-mono text-xs text-gray-500 font-bold ml-1 min-w-[28px]">
                          / 10
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Submit Bar */}
              <div className="border-t border-cyber-cyan/15 pt-4 mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <p className="text-[10px] font-mono text-gray-500 uppercase leading-snug">
                  ⚡ ALL METRICS ARE FINAL UPON SUBMISSION. SCORES ENCRYPTED TO NEON DB.
                </p>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {isCurrentTeamLocked ? (
                    <CyberButton
                      variant="green"
                      size="md"
                      onClick={() => setSelectedTeam(null)}
                      className="w-full sm:w-auto justify-center"
                    >
                      ← RETURN TO TEAM SEARCH
                    </CyberButton>
                  ) : (
                    <CyberButton
                      variant="cyan"
                      size="md"
                      onClick={handleFinalSubmit}
                      disabled={isSubmittingCurrentTeam || !judgingOpen || isTeamDisqualified}
                      className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-center"
                    >
                      {isSubmittingCurrentTeam ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> SUBMITTING EVALUATION...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" /> SUBMIT EVALUATION
                        </>
                      )}
                    </CyberButton>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
