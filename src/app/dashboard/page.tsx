"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  LogOut, 
  User, 
  CheckCircle, 
  Clock, 
  Lock, 
  ShieldCheck, 
  Save, 
  AlertTriangle,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { 
  getTeams, 
  getScores, 
  getConfig, 
  submitScores, 
  initDatabase,
  LeaderboardEntry
} from "@/lib/db";
import { Team, ScoringCriteria, ScoreRecord, Judge } from "@/lib/types";
import CyberButton from "@/components/CyberButton";
import CyberInput from "@/components/CyberInput";
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
  const [timerDuration, setTimerDuration] = useState(480);
  
  // Interactive UI State
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [evaluationScores, setEvaluationScores] = useState<Record<string, number>>({});
  const [showSignOffModal, setShowSignOffModal] = useState(false);
  const [signOffName, setSignOffName] = useState("");
  const [signOffDesignation, setSignOffDesignation] = useState("");
  const [signOffDate, setSignOffDate] = useState("");
  
  // UX States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Route security & mount initializers
  useEffect(() => {
    initDatabase();
    
    const session = sessionStorage.getItem("judge_session");
    if (!session) {
      router.push("/");
      return;
    }
    
    const parsedJudge = JSON.parse(session) as Judge;
    setJudge(parsedJudge);
    setSignOffName(parsedJudge.name);
    setSignOffDesignation(parsedJudge.designation);
    
    // Set default date to today's date in local time string YYYY-MM-DD
    const today = new Date().toISOString().split("T")[0];
    setSignOffDate(today);
    
    fetchData(parsedJudge.id);
  }, [router]);

  const fetchData = async (judgeId: string) => {
    setLoading(true);
    try {
      const allTeams = await getTeams();
      const allScores = await getScores();
      const config = await getConfig();
      
      setTeams(allTeams);
      setScores(allScores);
      setCriteria(config.criteriaList);
      setAnnounceResults(config.announceResults);
      setTimerDuration(config.timerDuration || 480);
      
      // Auto-select first team if available
      if (allTeams.length > 0) {
        handleSelectTeam(allTeams[0], allScores, config.criteriaList, judgeId);
      }
    } catch (err) {
      console.error("Transmission error:", err);
    } finally {
      setLoading(false);
    }
  };

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
    // Keep between 1 and 10
    const clamped = Math.max(1, Math.min(10, val));
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

  // Calculate live sum
  const calculateTotal = () => {
    return Object.values(evaluationScores).reduce((sum, score) => sum + score, 0);
  };

  const handleOpenSignOff = () => {
    setShowSignOffModal(true);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !judge) return;
    
    setActionLoading(true);
    
    const record: ScoreRecord = {
      teamId: selectedTeam.id,
      judgeId: judge.id,
      scores: evaluationScores,
      totalScore: calculateTotal(),
      submittedAt: new Date().toISOString(),
      judgeSignOff: {
        name: signOffName,
        designation: signOffDesignation,
        date: signOffDate
      }
    };

    try {
      await submitScores(record);
      
      // Re-fetch scores to update locked state
      const updatedScores = await getScores();
      setScores(updatedScores);
      setShowSignOffModal(false);
    } catch (err) {
      alert("FAIL: TRANSMISSION TIMEOUT. PLEASE TRY AGAIN.");
    } finally {
      setActionLoading(false);
    }
  };

  // Check which teams are completed by this judge
  const isTeamCompleted = (teamId: string) => {
    return scores.some((s) => s.teamId === teamId && s.judgeId === judge?.id);
  };

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
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-ping" />
                <span className="font-mono text-[9px] text-cyber-cyan tracking-wider">
                  LINK ESTABLISHED • JUDGE: {judge.name.toUpperCase()} ({judge.designation.toUpperCase()})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {announceResults && (
              <CyberButton 
                variant="magenta" 
                size="sm"
                onClick={() => router.push("/results")}
                className="flex items-center gap-1.5"
              >
                📊 LEADERBOARD
              </CyberButton>
            )}

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

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Sidebar team selectors (Col 1-3) */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          <div className="cyber-glass border border-cyber-cyan/15 p-4 flex flex-col gap-4">
            <h3 className="font-orbitron text-xs font-bold text-cyber-cyan tracking-wider uppercase border-b border-cyber-cyan/15 pb-2">
              📂 HACKATHON TEAMS ({teams.length})
            </h3>
            
            <div className="flex flex-col gap-2 max-h-[450px] overflow-y-auto pr-1">
              {teams.length === 0 ? (
                <p className="text-xs text-gray-500 font-mono italic">No teams loaded by central system.</p>
              ) : (
                teams.map((t) => {
                  const completed = isTeamCompleted(t.id);
                  const selected = selectedTeam?.id === t.id;
                  
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
                      <span className="truncate pr-2 font-medium">{t.name}</span>
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
                      Sign-off verified under: {currentRecord.judgeSignOff.name} ({currentRecord.judgeSignOff.designation})
                    </p>
                  </div>
                </div>
              )}

              {/* Grid of Sliders */}
              <div className="flex flex-col gap-5 py-2">
                {criteria.map((c, index) => {
                  const scoreVal = evaluationScores[c.id] || 5;
                  
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
                        <span className="font-orbitron text-xs font-bold tracking-wider text-gray-200 uppercase">
                          {index + 1}. {c.name}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {/* Range value controller */}
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
                          disabled={isCurrentTeamLocked}
                          className="flex-grow accent-cyber-cyan cursor-pointer disabled:cursor-not-allowed disabled:accent-cyber-green"
                        />
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                            <button
                              key={num}
                              disabled={isCurrentTeamLocked}
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
              {!isCurrentTeamLocked && (
                <div className="border-t border-cyber-cyan/15 pt-4 mt-2 flex justify-between items-center gap-4">
                  <p className="text-[10px] font-mono text-gray-500 uppercase leading-snug">
                    ⚡ CHECKLIST PROTOCOLS MANDATE REVIEWING ALL METRICS BEFORE FINAL TRANSMISSION.
                  </p>
                  <CyberButton
                    variant="cyan"
                    size="md"
                    onClick={handleOpenSignOff}
                    className="flex items-center gap-1.5 shrink-0"
                  >
                    <ShieldCheck className="w-4 h-4" /> LOCK & SUBMIT
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

      {/* High-Tech Sign-off Confirmation Modal */}
      {showSignOffModal && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cyber-bg-darker/80 backdrop-blur-sm">
          <div className="w-full max-w-lg cyber-glass-magenta border border-cyber-magenta/30 p-6 relative flex flex-col gap-5">
            {/* Corner tags */}
            <span className="absolute top-0 left-0 w-2.5 h-2.5 bg-cyber-magenta" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-cyber-magenta" />

            <div className="flex items-center gap-2 border-b border-cyber-magenta/25 pb-3">
              <Lock className="w-5 h-5 text-cyber-magenta animate-pulse" />
              <div>
                <h3 className="font-orbitron font-extrabold text-sm text-cyber-magenta text-glow-magenta uppercase tracking-wider">
                  🔐 SIGN-OFF TRANSACTION TERMINAL
                </h3>
                <p className="text-[9px] font-mono text-gray-500 uppercase">
                  VERIFYING LOCK FOR {selectedTeam.name}
                </p>
              </div>
            </div>

            <div className="bg-cyber-magenta/5 border border-cyber-magenta/20 p-3 font-mono text-xs text-gray-300 flex flex-col gap-2">
              <span className="text-cyber-magenta font-bold">⚡ SECURE RATINGS RECORDED:</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] border-t border-cyber-magenta/10 pt-2 mt-1">
                {criteria.map((c) => (
                  <div key={c.id} className="flex justify-between border-b border-gray-900 pb-1">
                    <span className="truncate pr-1 text-gray-500">{c.name}:</span>
                    <span className="text-cyber-cyan font-bold font-mono">{evaluationScores[c.id] || 5}/10</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-white border-t border-cyber-magenta/25 pt-2.5 mt-1.5">
                <span>CUMULATIVE METRIC SUM:</span>
                <span className="text-cyber-magenta text-glow-magenta font-orbitron font-extrabold text-sm">{calculateTotal()}/{criteria.length * 10}</span>
              </div>
            </div>

            {/* Compliance Form inputs */}
            <form onSubmit={handleFinalSubmit} className="flex flex-col gap-4">
              <CyberInput
                variant="magenta"
                label="VERIFY FULL JURIST NAME"
                value={signOffName}
                onChange={(e) => setSignOffName(e.target.value)}
                disabled={actionLoading}
                required
              />

              <CyberInput
                variant="magenta"
                label="VERIFY INSTITUTION / DESIGNATION"
                value={signOffDesignation}
                onChange={(e) => setSignOffDesignation(e.target.value)}
                disabled={actionLoading}
                required
              />

              <CyberInput
                variant="magenta"
                label="EVALUATION DATE KEY"
                type="date"
                value={signOffDate}
                onChange={(e) => setSignOffDate(e.target.value)}
                disabled={actionLoading}
                required
              />

              <div className="bg-cyber-red/5 border border-cyber-red/25 p-3 font-mono text-[10px] text-gray-400">
                ⚠️ WARNING: ONCE SIGN-OFF TRANSACTION COMPLETES, ALL VALUES ARE PARSED AND LOCKED AS READ-ONLY IN DATABASE. FURTHER RETRACTS OR EDITS ARE LOCKED.
              </div>

              <div className="flex gap-3 justify-end mt-2">
                <CyberButton
                  type="button"
                  variant="yellow"
                  size="sm"
                  onClick={() => setShowSignOffModal(false)}
                  disabled={actionLoading}
                >
                  ABORT TRANSACTION
                </CyberButton>

                <CyberButton
                  type="submit"
                  variant="magenta"
                  size="sm"
                  disabled={actionLoading}
                >
                  {actionLoading ? "SYNCING..." : "COMMIT TRANSMISSION"}
                </CyberButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
