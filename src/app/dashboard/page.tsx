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
  ChevronDown,
  Calendar
} from "lucide-react";
import { 
  getTeams, 
  getJudgeScores, 
  getConfig, 
  submitScores, 
  initDatabase,
  getEvents
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
  
  // Interactive UI State
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
      const [eventsList, allTeams, judgeScores, config] = await Promise.all([
        getEvents(),
        getTeams(eventId),
        getJudgeScores(judgeId, eventId),
        getConfig(eventId),
      ]);
      
      setEvents(eventsList || []);
      const matchedEv = eventsList.find((e) => e.id === eventId) || config.event || null;
      setCurrentEvent(matchedEv);

      setTeams(allTeams || []);
      setScores(judgeScores || []);
      setCriteria(config?.criteriaList || []);
      setAnnounceResults(Boolean(config?.announceResults));
      setJudgingOpen(config?.judgingOpen !== false);
      
      // Auto-select team on initial load or if current team belongs to different event
      if (allTeams && allTeams.length > 0) {
        const stillValid = selectedTeamRef.current && allTeams.some((t) => t.id === selectedTeamRef.current?.id);
        if (!stillValid) {
          handleSelectTeam(allTeams[0], judgeScores || [], config?.criteriaList || [], judgeId);
        }
      } else {
        setSelectedTeam(null);
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

  const completedCount = teams.filter((t) => isTeamCompleted(t.id)).length;

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
    <div className="min-h-screen flex flex-col relative pb-10 overflow-x-hidden">
      {/* Dynamic Header */}
      <header className="border-b border-cyber-cyan/15 bg-cyber-bg-darker/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Left: Branding & Event Identity */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Event Logo & Organizer Logo (or clean generic badge fallback) */}
            <div className="flex items-center gap-2 shrink-0">
              {currentEvent?.logo && (
                <div className="p-1.5 bg-black/40 border border-cyber-cyan/30 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={currentEvent.logo} 
                    alt={currentEvent.name} 
                    className="h-8 max-w-[110px] object-contain"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {currentEvent?.organizerLogo && (
                <div className="p-1.5 bg-black/40 border border-gray-700 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={currentEvent.organizerLogo} 
                    alt={currentEvent.organizer || "Organizer"} 
                    className="h-8 max-w-[110px] object-contain"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {!currentEvent?.logo && !currentEvent?.organizerLogo && (
                <span className="p-2 bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20 shrink-0">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </span>
              )}
            </div>
            
            <div className="min-w-0">
              <h1 className="font-orbitron font-extrabold text-base sm:text-lg text-white tracking-widest text-glow-cyan uppercase truncate">
                {currentEvent?.name || "EVALUATION DECK"}
              </h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${realtimeStatus === "connected" ? "bg-cyber-green animate-ping" : "bg-cyber-yellow"}`} />
                <span className="font-mono text-[9px] text-cyber-cyan tracking-wider truncate">
                  {realtimeStatus === "connected" ? "⚡ LIVE SYNC" : "OFFLINE / POLLING"} • JUDGE: {judge.name.toUpperCase()} • [{completedCount}/{teams.length} EVALUATED]
                  {currentEvent?.organizer ? ` • ${currentEvent.organizer}` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Event Info / Switcher & Logout */}
          <div className="flex items-center gap-2.5 flex-wrap justify-between md:justify-end">
            {/* Event Selector Dropdown (Only for admins; judges are locked to assigned event) */}
            {judge.role === "admin" && events.length > 1 && (
              <div className="flex items-center gap-1.5 bg-cyber-bg-darker border border-cyber-cyan/25 px-2.5 py-1 text-xs font-mono">
                <Layers className="w-3.5 h-3.5 text-cyber-cyan shrink-0" />
                <label htmlFor="dashboard-event-select" className="sr-only">Select Event</label>
                <select
                  id="dashboard-event-select"
                  aria-label="Select Evaluation Event"
                  value={selectedEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  disabled={!!submittingTeamId}
                  className="bg-transparent text-gray-200 outline-none cursor-pointer pr-1 text-xs"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-gray-900 text-white">
                      {ev.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <CyberButton
              variant="red"
              size="sm"
              onClick={handleLogout}
              disabled={!!submittingTeamId}
              className="flex items-center gap-1.5 shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" /> DISCONNECT
            </CyberButton>
          </div>
        </div>
      </header>

      {/* Floating Feedback Banner */}
      {feedback && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 w-full">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 w-full">
          <div className="p-3 bg-cyber-yellow/15 border border-cyber-yellow/40 text-cyber-yellow font-mono text-xs flex items-center gap-3">
            <AlertOctagon className="w-4 h-4 shrink-0 animate-pulse" />
            <span>⚡ NOTICE: Judging evaluation is currently paused for this event. Submissions are temporarily frozen.</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        
        {/* Left Side: Sidebar team selectors (Col 1-3 on desktop, full width on mobile) */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          <div className="cyber-glass border border-cyber-cyan/15 p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-cyber-cyan/15 pb-2">
              <h2 className="font-orbitron text-xs font-bold text-cyber-cyan tracking-wider uppercase">
                📂 TEAMS ({teams.length})
              </h2>
              <span className="font-mono text-[9px] text-gray-400">
                {completedCount}/{teams.length} DONE
              </span>
            </div>
            
            {/* Scrollable teams list */}
            <div className="flex flex-col gap-2 max-h-[380px] lg:max-h-[460px] overflow-y-auto pr-1">
              {teams.length === 0 ? (
                <p className="text-xs text-gray-500 font-mono italic p-2">No teams registered for this event yet.</p>
              ) : (
                teams.map((t) => {
                  const completed = isTeamCompleted(t.id);
                  const selected = selectedTeam?.id === t.id;
                  const isDq = t.name.startsWith("[DISQUALIFIED]");
                  const isBusySubmitting = submittingTeamId === t.id;
                  
                  return (
                    <button
                      key={t.id}
                      disabled={!!submittingTeamId}
                      onClick={() => handleSelectTeam(t, scores, criteria, judge.id)}
                      className={`
                        w-full text-left p-2.5 sm:p-3 flex justify-between items-center transition-all duration-300 font-mono text-xs
                        ${selected 
                          ? "bg-cyber-cyan/15 border-l-4 border-cyber-cyan text-white shadow-[0_0_10px_rgba(6,182,212,0.1)]" 
                          : "bg-cyber-bg-darker/60 hover:bg-cyber-cyan/5 border-l-2 border-gray-800 text-gray-400"
                        }
                        ${submittingTeamId ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      <span className={`truncate pr-2 font-medium ${isDq ? "line-through text-cyber-red" : ""}`}>
                        {t.name}
                      </span>
                      {isBusySubmitting ? (
                        <span className="flex items-center gap-1 text-[9px] text-cyber-yellow bg-cyber-yellow/10 px-1.5 py-0.5 uppercase font-bold shrink-0 animate-pulse">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> SYNCING
                        </span>
                      ) : completed ? (
                        <span className="flex items-center gap-1 text-[9px] text-cyber-green bg-cyber-green/10 px-1.5 py-0.5 uppercase font-bold shrink-0">
                          <Lock className="w-2.5 h-2.5" /> LOCKED
                        </span>
                      ) : (
                        <span className="text-[9px] text-cyber-yellow bg-cyber-yellow/10 px-1.5 py-0.5 uppercase shrink-0 font-semibold">
                          PENDING
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Center: Dynamic Evaluator Sheet (Col 4-12 on desktop, full width on mobile) */}
        <section className="lg:col-span-9 flex flex-col gap-6 w-full">
          {selectedTeam ? (
            <div className="cyber-glass border border-cyber-cyan/15 p-4 sm:p-6 flex flex-col gap-5 relative">
              {/* Glowing header clip */}
              <span className="absolute top-0 right-0 w-3 h-3 bg-cyber-cyan/40" />

              {/* Header details */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-cyber-cyan/15 pb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-cyber-cyan uppercase tracking-widest bg-cyber-cyan/10 px-2 py-0.5 border border-cyber-cyan/20">
                      EVALUATION TARGET
                    </span>
                    {selectedTeam.teamCode && (
                      <span className="text-[9px] font-mono text-gray-400 bg-gray-900 px-1.5 py-0.5">
                        {selectedTeam.teamCode}
                      </span>
                    )}
                  </div>
                  <h2 className="font-orbitron font-extrabold text-lg sm:text-xl text-white tracking-wide mt-1.5 uppercase truncate">
                    {selectedTeam.name}
                  </h2>
                  {selectedTeam.projectName && selectedTeam.projectName !== selectedTeam.name && (
                    <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                      Project: {selectedTeam.projectName}
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
                <div className="bg-cyber-green/15 border border-cyber-green/30 p-3 flex items-start gap-3">
                  <Lock className="w-5 h-5 text-cyber-green mt-0.5 shrink-0 animate-pulse" />
                  <div className="flex flex-col gap-0.5 font-mono text-xs">
                    <span className="text-cyber-green font-bold uppercase tracking-wider">
                      🔒 SUBMISSION FINALIZED & ENCRYPTED
                    </span>
                    <p className="text-[11px] text-gray-400">
                      Scores locked as read-only at {currentRecord ? new Date(currentRecord.submittedAt).toLocaleTimeString() : "recorded time"}.
                      Sign-off verified under: {currentRecord?.judgeSignOff?.name || judge.name} ({currentRecord?.judgeSignOff?.designation || judge.designation})
                    </p>
                  </div>
                </div>
              )}

              {/* Disqualified Warning */}
              {isTeamDisqualified && (
                <div className="bg-cyber-red/15 border border-cyber-red/30 p-3 flex items-start gap-3">
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

              {/* ============================================================== */}
              {/* REQUIREMENT 1: PROPER NUMERIC SCORE INPUTS (1-10) IN A BOX     */}
              {/* ============================================================== */}
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
                        p-3.5 border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3
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
                          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center border border-cyber-cyan/30 bg-cyber-bg-darker hover:bg-cyber-cyan/20 text-cyber-cyan disabled:opacity-25 disabled:cursor-not-allowed font-mono text-base font-bold transition-all active:scale-95"
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
                              w-14 h-9 sm:w-16 sm:h-10 text-center font-orbitron font-extrabold text-base sm:text-lg
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
                          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center border border-cyber-cyan/30 bg-cyber-bg-darker hover:bg-cyber-cyan/20 text-cyber-cyan disabled:opacity-25 disabled:cursor-not-allowed font-mono text-base font-bold transition-all active:scale-95"
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
              {!isCurrentTeamLocked && !isTeamDisqualified && (
                <div className="border-t border-cyber-cyan/15 pt-4 mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <p className="text-[10px] font-mono text-gray-500 uppercase leading-snug">
                    ⚡ ALL METRICS ARE FINAL UPON SUBMISSION. SCORES ENCRYPTED TO NEON DB.
                  </p>
                  <CyberButton
                    variant="cyan"
                    size="md"
                    onClick={handleFinalSubmit}
                    disabled={isSubmittingCurrentTeam || !judgingOpen}
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
                </div>
              )}
            </div>
          ) : (
            <div className="cyber-glass border border-cyber-cyan/15 p-12 text-center flex flex-col items-center justify-center gap-4">
              <AlertTriangle className="w-8 h-8 text-cyber-yellow animate-pulse" />
              <p className="font-orbitron text-sm text-gray-400 uppercase tracking-widest">
                NO TEAM DATA REGISTERED FOR THIS EVENT
              </p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
