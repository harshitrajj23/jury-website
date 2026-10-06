"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  LogOut, 
  Clock, 
  Lock, 
  ShieldCheck, 
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertOctagon
} from "lucide-react";
import { 
  getTeams, 
  getJudgeScores, 
  getConfig, 
  submitScores, 
  initDatabase
} from "@/lib/db";
import { Team, ScoringCriteria, ScoreRecord, Judge } from "@/lib/types";
import { useRealtimeSync } from "@/lib/useRealtimeSync";
import CyberButton from "@/components/CyberButton";
import Timer from "@/components/Timer";
import RulesPanel from "@/components/RulesPanel";

export default function JudgeDashboardPage() {
  const router = useRouter();
  
  // Authentication & Session
  const [judge, setJudge] = useState<Judge | null>(null);
  
  // DB State
  const [teams, setTeams] = useState<Team[]>([]);
  const [criteria, setCriteria] = useState<ScoringCriteria[]>([]);
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [announceResults, setAnnounceResults] = useState(false);
  const [judgingOpen, setJudgingOpen] = useState(true);
  const [timerDuration, setTimerDuration] = useState(480);
  
  // Interactive UI State
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [evaluationScores, setEvaluationScores] = useState<Record<string, number>>({});
  
  // Feedback Toasts
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  // UX States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const isInitialLoadRef = useRef(true);
  const selectedTeamRef = useRef<Team | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    selectedTeamRef.current = selectedTeam;
  }, [selectedTeam]);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };
  
  const fetchData = async (judgeId: string, isBackground = false) => {
    if (!isBackground && isInitialLoadRef.current) {
      setLoading(true);
    }
    try {
      const [allTeams, judgeScores, config] = await Promise.all([
        getTeams(),
        getJudgeScores(judgeId),
        getConfig(),
      ]);
      
      setTeams(allTeams || []);
      setScores(judgeScores || []);
      setCriteria(config?.criteriaList || []);
      setAnnounceResults(Boolean(config?.announceResults));
      setJudgingOpen(config?.judgingOpen !== false);
      setTimerDuration(config?.timerDuration || 480);
      
      // Auto-select first active team on initial load if none selected yet
      if (!selectedTeamRef.current && allTeams && allTeams.length > 0) {
        handleSelectTeam(allTeams[0], judgeScores || [], config?.criteriaList || [], judgeId);
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
      fetchData(parsedJudge.id, false);
    } catch (e) {
      router.push("/");
    }
  }, [router]);

  // Realtime WebSocket sync — auto-refresh silently when DB changes
  const handleRealtimeChange = useCallback(() => {
    if (judge) {
      fetchData(judge.id, true);
    }
  }, [judge]);

  const realtimeStatus = useRealtimeSync({
    tables: ["Score", "Team", "Settings", "Criteria"],
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
    setSelectedTeam(team);
    
    // Check if score record already exists for this team by this judge
    const matchedRecord = allScores.find(
      (s) => s.teamId === team.id && s.judgeId === judgeId
    );
    
    if (matchedRecord) {
      setEvaluationScores(matchedRecord.scores);
    } else {
      // Default to mid-range score (5) for all criteria
      const defaultScores: Record<string, number> = {};
      activeCriteria.forEach((c) => {
        defaultScores[c.id] = 5;
      });
      setEvaluationScores(defaultScores);
    }
  };

  const handleScoreChange = (criteriaId: string, val: number) => {
    // Keep strictly between 1 and 10
    const clamped = Math.max(1, Math.min(10, Math.round(val)));
    setEvaluationScores((prev) => ({
      ...prev,
      [criteriaId]: clamped,
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

  // Calculate live sum
  const calculateTotal = () => {
    return Object.values(evaluationScores).reduce((sum, score) => sum + (Number(score) || 0), 0);
  };

  // Submit evaluation with multi-click protection & atomic batch execution
  const handleFinalSubmit = async () => {
    if (!selectedTeam || !judge || isSubmittingRef.current || actionLoading) return;
    
    if (!judgingOpen) {
      showFeedback("error", "JUDGING_LOCKED: Judging is currently paused by the administrator.");
      return;
    }

    if (isTeamDisqualified) {
      showFeedback("error", "EVALUATION_DENIED: Disqualified teams cannot receive scores.");
      return;
    }

    // Validate all active criteria are scored
    for (const c of criteria) {
      const val = evaluationScores[c.id];
      if (val === undefined || val === null || val < 1 || val > 10) {
        showFeedback("error", `VALIDATION_ERROR: Missing valid score (1-10) for "${c.name}".`);
        return;
      }
    }

    isSubmittingRef.current = true;
    setActionLoading(true);
    
    const record: ScoreRecord = {
      teamId: selectedTeam.id,
      judgeId: judge.id,
      scores: evaluationScores,
      totalScore: calculateTotal(),
      submittedAt: new Date().toISOString(),
      judgeSignOff: {
        name: judge.name,
        designation: judge.designation,
        date: new Date().toISOString()
      }
    };

    try {
      const res = await submitScores(record);
      if (!res.success) {
        showFeedback("error", res.error || "TRANSMISSION_ERROR: Score submission rejected.");
        return;
      }
      
      // Re-fetch scoped scores to update locked state immediately
      const updatedScores = await getJudgeScores(judge.id);
      setScores(updatedScores);
      showFeedback("success", `✅ EVALUATION ENCRYPTED & SUBMITTED FOR ${selectedTeam.name.toUpperCase()}`);
    } catch (err: any) {
      showFeedback("error", `FAIL: TRANSMISSION TIMEOUT (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Check which teams are completed by this judge
  const isTeamCompleted = (teamId: string) => {
    return scores.some((s) => s.teamId === teamId && s.judgeId === judge?.id);
  };

  const completedCount = teams.filter((t) => isTeamCompleted(t.id)).length;

  if (loading || !judge) {
    return (
      <div className="min-h-screen bg-cyber-bg flex justify-center items-center font-mono text-cyber-cyan">
        <div className="flex flex-col items-center gap-3">
          <Clock className="w-10 h-10 animate-spin" />
          <p className="font-orbitron tracking-widest text-sm uppercase">LOADING SECURE JURY ENVIRONMENT...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative pb-10">
      {/* Dynamic Header */}
      <header className="border-b border-cyber-cyan/15 bg-cyber-bg-darker/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <h1 className="font-orbitron font-extrabold text-lg text-white tracking-widest text-glow-cyan uppercase">
                SCORESPHERE JUDGING DECK
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${realtimeStatus === "connected" ? "bg-cyber-green animate-ping" : realtimeStatus === "connecting" ? "bg-cyber-yellow animate-pulse" : "bg-cyber-red"}`} />
                <span className="font-mono text-[9px] text-cyber-cyan tracking-wider">
                  {realtimeStatus === "connected" ? "⚡ LIVE" : realtimeStatus === "connecting" ? "SYNCING" : "OFFLINE"} • JUDGE: {judge.name.toUpperCase()} ({judge.designation.toUpperCase()}) • [{completedCount}/{teams.length} EVALUATED]
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <CyberButton
              variant="red"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-1.5"
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
            <span>⚡ NOTICE: Judging evaluation is currently paused by master control. Submissions are temporarily frozen.</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Sidebar team selectors (Col 1-3) */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          <div className="cyber-glass border border-cyber-cyan/15 p-4 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-cyber-cyan/15 pb-2">
              <h3 className="font-orbitron text-xs font-bold text-cyber-cyan tracking-wider uppercase">
                📂 TEAMS ({teams.length})
              </h3>
              <span className="font-mono text-[9px] text-gray-400">
                {completedCount}/{teams.length} DONE
              </span>
            </div>
            
            <div className="flex flex-col gap-2 max-h-[450px] overflow-y-auto pr-1">
              {teams.length === 0 ? (
                <p className="text-xs text-gray-500 font-mono italic">No teams loaded by central system.</p>
              ) : (
                teams.map((t) => {
                  const completed = isTeamCompleted(t.id);
                  const selected = selectedTeam?.id === t.id;
                  const isDq = t.name.startsWith("[DISQUALIFIED]");
                  
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTeam(t, scores, criteria, judge.id)}
                      className={`
                        w-full text-left p-3 flex justify-between items-center transition-all duration-300 font-mono text-xs
                        ${selected 
                          ? "bg-cyber-cyan/15 border-l-4 border-cyber-cyan text-white shadow-[0_0_10px_rgba(6,182,212,0.1)]" 
                          : "bg-cyber-bg-darker/60 hover:bg-cyber-cyan/5 border-l-2 border-gray-800 text-gray-400"
                        }
                      `}
                    >
                      <span className={`truncate pr-2 font-medium ${isDq ? "line-through text-cyber-red" : ""}`}>
                        {t.name}
                      </span>
                      {completed ? (
                        <span className="flex items-center gap-1 text-[10px] text-cyber-green bg-cyber-green/10 px-1.5 py-0.5 uppercase font-bold shrink-0">
                          <Lock className="w-2.5 h-2.5" /> LOCKED
                        </span>
                      ) : (
                        <span className="text-[10px] text-cyber-yellow bg-cyber-yellow/10 px-1.5 py-0.5 uppercase shrink-0 font-semibold">
                          PENDING
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Time Countdown clock */}
          <Timer duration={timerDuration} />

          {/* Compliance Rules Panel */}
          <RulesPanel />
        </section>

        {/* Center: Dynamic Evaluator Sheet (Col 4-12) */}
        <section className="lg:col-span-9 flex flex-col gap-6">
          {selectedTeam ? (
            <div className="cyber-glass border border-cyber-cyan/15 p-6 flex flex-col gap-6 relative">
              {/* Glowing header clips */}
              <span className="absolute top-0 right-0 w-3 h-3 bg-cyber-cyan/40" />

              {/* Header details */}
              <div className="flex justify-between items-start gap-4 border-b border-cyber-cyan/15 pb-4">
                <div>
                  <span className="text-[9px] font-mono text-cyber-cyan uppercase tracking-widest bg-cyber-cyan/10 px-2 py-0.5 border border-cyber-cyan/20">
                    EVALUATION TARGET
                  </span>
                  <h2 className="font-orbitron font-extrabold text-xl text-white tracking-wide mt-1.5 uppercase">
                    {selectedTeam.name}
                  </h2>
                </div>
                <div className="text-right">
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
                      Scores locked as read-only on database at {new Date(currentRecord.submittedAt).toLocaleTimeString()}.
                      Sign-off verified under: {currentRecord.judgeSignOff?.name || judge.name} ({currentRecord.judgeSignOff?.designation || judge.designation})
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

              {/* Grid of Sliders */}
              <div className="flex flex-col gap-5 py-2">
                {criteria.map((c, index) => {
                  const scoreVal = evaluationScores[c.id] || 5;
                  const isLocked = isCurrentTeamLocked || isTeamDisqualified || !judgingOpen;
                  
                  return (
                    <div 
                      key={c.id} 
                      className={`
                        p-3 border transition-all duration-300
                        ${isCurrentTeamLocked 
                          ? "border-gray-800 bg-cyber-bg-darker/20" 
                          : "border-cyber-cyan/10 bg-cyber-bg-darker/35 hover:border-cyber-cyan/20"
                        }
                      `}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <span className="font-orbitron text-xs font-bold tracking-wider text-gray-200 uppercase">
                            {index + 1}. {c.name}
                          </span>
                          {c.weight && (
                            <span className="text-[9px] font-mono text-cyber-cyan/60 ml-2">
                              (Weight: {c.weight})
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className={`w-7 h-7 flex items-center justify-center font-mono text-xs font-bold border ${isCurrentTeamLocked ? "border-gray-700 text-cyber-green" : "border-cyber-cyan/30 text-cyber-cyan"}`}>
                            {scoreVal}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={scoreVal}
                          onChange={(e) => handleScoreChange(c.id, parseInt(e.target.value))}
                          disabled={isLocked}
                          className="flex-grow accent-cyber-cyan cursor-pointer disabled:cursor-not-allowed disabled:accent-cyber-green"
                        />
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                            <button
                              key={num}
                              disabled={isLocked}
                              onClick={() => handleScoreChange(c.id, num)}
                              className={`
                                w-4 h-4 font-mono text-[9px] flex items-center justify-center transition-all duration-200 border
                                ${scoreVal === num 
                                  ? (isCurrentTeamLocked 
                                      ? "bg-cyber-green/20 border-cyber-green text-cyber-green" 
                                      : "bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan font-bold"
                                    ) 
                                  : "border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300"
                                }
                              `}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              {!isCurrentTeamLocked && !isTeamDisqualified && (
                <div className="border-t border-cyber-cyan/15 pt-4 mt-2 flex justify-between items-center gap-4">
                  <p className="text-[10px] font-mono text-gray-500 uppercase leading-snug">
                    ⚡ ALL METRICS ARE FINAL ON SUBMISSION.
                  </p>
                  <CyberButton
                    variant="cyan"
                    size="md"
                    onClick={handleFinalSubmit}
                    disabled={actionLoading || !judgingOpen}
                    className="flex items-center gap-1.5 shrink-0"
                  >
                    <ShieldCheck className="w-4 h-4" /> {actionLoading ? "SUBMITTING..." : "SUBMIT EVALUATION"}
                  </CyberButton>
                </div>
              )}
            </div>
          ) : (
            <div className="cyber-glass border border-cyber-cyan/15 p-12 text-center flex flex-col items-center justify-center gap-4">
              <AlertTriangle className="w-8 h-8 text-cyber-yellow animate-pulse" />
              <p className="font-orbitron text-sm text-gray-400 uppercase tracking-widest">
                NO TEAM DATA REGISTERED
              </p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
