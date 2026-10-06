"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  Users, 
  Layers, 
  Download, 
  Trash2, 
  Plus, 
  Lock, 
  Settings, 
  Grid,
  Radio,
  RefreshCw,
  AlertOctagon,
  Key,
  Save,
  Trophy,
  Clock
} from "lucide-react";
import { 
  getJudges, 
  addJudge, 
  removeJudge, 
  getTeams, 
  addTeam, 
  removeTeam, 
  getScores, 
  getConfig, 
  toggleAnnounceResults,
  updateCriteria,
  resetDatabase,
  initDatabase,
  getLeaderboard,
  updateTimerDuration,
  toggleDisqualifyTeam
} from "@/lib/db";
import { Judge, Team, ScoringCriteria, ScoreRecord, AppConfig, LeaderboardEntry } from "@/lib/types";
import { useRealtimeSync } from "@/lib/useRealtimeSync";
import CyberButton from "@/components/CyberButton";
import CyberInput from "@/components/CyberInput";

export default function AdminPage() {
  const router = useRouter();

  // Authentication State
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // App Database States
  const [judges, setJudges] = useState<Judge[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [criteria, setCriteria] = useState<ScoringCriteria[]>([]);
  const [announceResults, setAnnounceResults] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [timerDuration, setTimerDuration] = useState(8); // in minutes

  // UI Tabs: 'overview' | 'judges' | 'teams' | 'criteria' | 'matrix' | 'system'
  const [activeTab, setActiveTab] = useState("overview");

  // Dynamic Add Forms state
  const [newJudgeName, setNewJudgeName] = useState("");
  const [newJudgeDesg, setNewJudgeDesg] = useState("");
  const [newJudgeUser, setNewJudgeUser] = useState("");
  const [newJudgePass, setNewJudgePass] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newCriteriaName, setNewCriteriaName] = useState("");

  // Loading indicator states
  const [dbLoading, setDbLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    initDatabase();
    // Check if already logged in from a previous session
    const session = sessionStorage.getItem("admin_session");
    if (session === "authorized") {
      setIsAdmin(true);
      fetchDbData(false);
    } else {
      setDbLoading(false);
    }
  }, []);

  const fetchDbData = async (isBackground = false) => {
    if (!isBackground && isInitialLoadRef.current) {
      setDbLoading(true);
    }
    try {
      const [jList, tList, sList, config, lList] = await Promise.all([
        getJudges(),
        getTeams(),
        getScores(),
        getConfig(),
        getLeaderboard(),
      ]);

      setJudges(jList || []);
      setTeams(tList || []);
      setScores(sList || []);
      setCriteria(config?.criteriaList || []);
      setAnnounceResults(Boolean(config?.announceResults));
      setLeaderboard(lList || []);
      setTimerDuration(Math.round((config?.timerDuration || 480) / 60));
      isInitialLoadRef.current = false;
    } catch (err) {
      console.error("Transmission breakdown:", err);
    } finally {
      setDbLoading(false);
    }
  };

  // Realtime WebSocket sync — auto-refresh silently when DB changes
  const handleRealtimeChange = useCallback(() => {
    if (isAdmin) {
      fetchDbData(true);
    }
  }, [isAdmin]);

  const realtimeStatus = useRealtimeSync({
    tables: ["Score", "Team", "User", "Criteria", "Settings"],
    onDataChange: handleRealtimeChange,
    enabled: isAdmin,
    intervalMs: 20000,
  });

  const handleSaveTimer = async () => {
    setActionLoading(true);
    try {
      const res = await updateTimerDuration(timerDuration * 60); // convert minutes to seconds
      if (!res.success) {
        alert(`FAIL: TIMER SETTING TRANSMISSION FAILURE.\n\n${res.error}`);
        return;
      }
      alert(`SYSTEM STATUS: TIME LIMIT SET TO ${timerDuration} MINUTES.`);
      await fetchDbData(false);
    } catch (err: any) {
      alert(`FAIL: TIMER SETTING TRANSMISSION FAILURE. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    const ADMIN_PASSWORD = "admin123";

    if (adminPass !== ADMIN_PASSWORD) {
      setAuthError("INVALID PASSWORD. ACCESS DENIED.");
      setAuthLoading(false);
      return;
    }

    sessionStorage.setItem("admin_session", "authorized");
    setIsAdmin(true);
    fetchDbData(false);
    setAuthLoading(false);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem("admin_session");
    setIsAdmin(false);
  };

  // Add Dynamic Judge
  const handleAddJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJudgeName || !newJudgeDesg || !newJudgeUser || !newJudgePass) return;
    setActionLoading(true);
    try {
      const res = await addJudge({
        username: newJudgeUser,
        name: newJudgeName,
        designation: newJudgeDesg,
        password: newJudgePass,
      });
      if (!res.success) {
        alert(`FAIL: JUDGE REGISTRATION REJECTED.\n\n${res.error}`);
        return;
      }
      // Reset inputs
      setNewJudgeName("");
      setNewJudgeDesg("");
      setNewJudgeUser("");
      setNewJudgePass("");
      await fetchDbData(false);
      alert("✅ JUDGE REGISTERED SUCCESSFULLY.");
    } catch (err: any) {
      alert(`FAIL: JUDGE REGISTRATION REJECTED. (${err?.message || "Database connection error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  // Remove Judge
  const handleRemoveJudge = async (id: string) => {
    if (!confirm("WARNING: ALL SCORES SUBMITTED BY THIS JUDGE WILL BE ERASED. PROCEED?")) return;
    setActionLoading(true);
    try {
      const res = await removeJudge(id);
      if (!res.success) {
        alert(`FAIL: TRANSACTION DELETION ABORTED.\n\n${res.error}`);
        return;
      }
      await fetchDbData(false);
    } catch (err: any) {
      alert(`FAIL: TRANSACTION DELETION ABORTED. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  // Add Dynamic Team
  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setActionLoading(true);
    try {
      const res = await addTeam(newTeamName.trim());
      if (!res.success) {
        alert(`FAIL: TEAM REGISTRATION REJECTED.\n\n${res.error}`);
        return;
      }
      setNewTeamName("");
      await fetchDbData(false);
      alert("✅ TEAM REGISTERED SUCCESSFULLY.");
    } catch (err: any) {
      alert(`FAIL: TEAM REGISTRATION REJECTED. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  // Remove Team
  const handleRemoveTeam = async (id: string) => {
    if (!confirm("WARNING: REMOVING THIS TEAM WILL DELETE ALL RECEIVED JUDGING SCORINGS. CONTINUANCE?")) return;
    setActionLoading(true);
    try {
      const res = await removeTeam(id);
      if (!res.success) {
        alert(`FAIL: TEAM ELIMINATION FAILED.\n\n${res.error}`);
        return;
      }
      await fetchDbData(false);
    } catch (err: any) {
      alert(`FAIL: TEAM ELIMINATION FAILED. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisqualifyTeam = async (id: string, name: string, isDisqualified: boolean) => {
    if (!confirm(isDisqualified ? "REINSTATE this team back to the active leaderboard?" : "DISQUALIFY this team? They will be removed from the leaderboard.")) return;
    setActionLoading(true);
    try {
      const res = await toggleDisqualifyTeam(id, name, !isDisqualified);
      if (!res.success) {
        alert(`FAIL: TEAM DISQUALIFICATION STATE TOGGLE FAILED.\n\n${res.error}`);
        return;
      }
      await fetchDbData(false);
    } catch (err: any) {
      alert(`FAIL: TEAM DISQUALIFICATION STATE TOGGLE FAILED. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  // Renaming/Editing criteria dynamically
  const handleCriteriaChange = async (index: number, newName: string) => {
    const updated = [...criteria];
    updated[index].name = newName;
    setCriteria(updated);
  };

  const handleRemoveCriteria = (id: string) => {
    if (criteria.length <= 1) {
      alert("FAIL: AT LEAST ONE SCORING CRITERION MUST PERSIST.");
      return;
    }
    const filtered = criteria.filter((c) => c.id !== id);
    setCriteria(filtered);
  };

  const handleAddCriteria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCriteriaName.trim()) return;
    const newCriteria: ScoringCriteria = {
      id: `c_${Date.now()}`,
      name: newCriteriaName.trim(),
    };
    setCriteria((prev) => [...prev, newCriteria]);
    setNewCriteriaName("");
  };

  const handleSaveCriteria = async () => {
    setActionLoading(true);
    try {
      const res = await updateCriteria(criteria);
      if (!res.success) {
        alert(`FAIL: CONFIG TRANSMISSION FAILURE.\n\n${res.error}`);
        return;
      }
      alert("SYSTEM STATUS: SCORING PARAMETERS UPDATED.");
    } catch (err: any) {
      alert(`FAIL: CONFIG TRANSMISSION FAILURE. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Results Announcement
  const handleToggleBroadcast = async () => {
    setActionLoading(true);
    try {
      const nextState = !announceResults;
      const res = await toggleAnnounceResults(nextState);
      if (!res.success) {
        alert(`FAIL: BROADCAST TOGGLE FAULT.\n\n${res.error}`);
        return;
      }
      setAnnounceResults(nextState);
    } catch (err: any) {
      alert(`FAIL: BROADCAST TOGGLE FAULT. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  // Factory reset
  const handleFactoryReset = async () => {
    if (!confirm("🚨 DESTROY ALL DATA? THIS WILL ERASE ALL JUDGES, TEAMS, CONFIGS, AND RATINGS RECORDED. THIS ACTION CANNOT BE UNDONE.")) return;
    setActionLoading(true);
    try {
      const res = await resetDatabase();
      if (!res.success) {
        alert(`FAIL: DECONSTRUCT TRIGGER REJECTED.\n\n${res.error}`);
        return;
      }
      await fetchDbData(false);
      alert("DATABASE RE-MOUNTED TO FACTORY DEFAULTS.");
    } catch (err: any) {
      alert(`FAIL: DECONSTRUCT TRIGGER REJECTED. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  // Client-Side Dynamic CSV compilation and Download
  const handleExportCSV = () => {
    if (teams.length === 0) return;

    // Headers: Team Name, Judge 1, Judge 2, ..., Average Total
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header Row
    const judgeHeaders = judges.map((j) => `"${j.name} (${j.designation})"`).join(",");
    csvContent += `Team Name,${judgeHeaders},Average Score\n`;

    // Data Rows
    teams.forEach((t) => {
      const teamScores = scores.filter((s) => s.teamId === t.id);
      const rowScores = judges.map((j) => {
        const match = teamScores.find((s) => s.judgeId === j.id);
        return match ? match.totalScore : ""; // blank if not scored
      });
      
      const averageScore = teamScores.length > 0
        ? parseFloat((teamScores.reduce((sum, s) => sum + s.totalScore, 0) / teamScores.length).toFixed(2))
        : 0;

      const row = `"${t.name}",${rowScores.join(",")},${averageScore}`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SCORESPHERE_Evaluation_Results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate telemetry counts
  const expectedScoresCount = judges.length * teams.length;
  const submittedScoresCount = scores.length;
  const telemetryProgressPercent = expectedScoresCount > 0 
    ? Math.round((submittedScoresCount / expectedScoresCount) * 100) 
    : 0;

  // Render Login state
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden bg-cyber-bg">
        {/* Background glow overlay */}
        <div className="absolute w-[300px] h-[300px] bg-cyber-magenta/5 rounded-full blur-[100px] top-[10%] left-[20%] pointer-events-none" />

        <div className="w-full max-w-md cyber-glass-magenta p-8 border border-cyber-magenta/25 relative flex flex-col gap-6">
          <span className="absolute top-0 left-0 w-2 h-2 bg-cyber-magenta" />
          <span className="absolute bottom-0 right-0 w-2 h-2 bg-cyber-magenta" />

          <div className="flex flex-col gap-1 text-center border-b border-cyber-magenta/15 pb-4">
            <div className="flex justify-center items-center gap-2 mb-1.5">
              <ShieldCheck className="w-5 h-5 text-cyber-magenta animate-pulse" />
              <span className="font-mono text-xs text-cyber-magenta/80 tracking-widest font-bold uppercase">
                SCORESPHERE - CENTRAL SYSTEM
              </span>
            </div>
            <h1 className="font-orbitron font-extrabold text-2xl text-white tracking-widest text-glow-magenta">
              ADMIN CONTROL
            </h1>
            <p className="font-sans text-[10px] text-gray-500 tracking-wider uppercase mt-1">
              PROTECTED SECURE BACKEND NODE
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="flex flex-col gap-5">
            <CyberInput
              variant="magenta"
              label="ADMIN PASSWORD"
              type="password"
              placeholder="••••••••"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              disabled={authLoading}
              required
            />

            {authError && (
              <div className="bg-cyber-red/10 border border-cyber-red/30 px-3.5 py-2.5 font-mono text-xs text-cyber-red">
                ⚡ AUTH_FAULT: {authError}
              </div>
            )}

            <div className="flex flex-col gap-3 mt-2">
              <CyberButton
                type="submit"
                variant="magenta"
                fullWidth
                disabled={authLoading}
              >
                {authLoading ? "DECRYPTING NODE..." : "INITIALIZE MASTER ACCESS"}
              </CyberButton>
            </div>
          </form>
        </div>
        <footer className="mt-8 text-center text-[10px] text-gray-600 font-mono tracking-widest uppercase">
          SECURE PROTOCOL CLOUD INTEGRATED • SCORESPHERE © 2026
        </footer>
      </div>
    );
  }

  // Render Dashboard loading state
  if (dbLoading) {
    return (
      <div className="min-h-screen bg-cyber-bg flex justify-center items-center font-mono text-cyber-magenta">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-10 h-10 animate-spin" />
          <p className="font-orbitron tracking-widest text-sm uppercase">COMPILING MASTER DATA MATRIX...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative pb-12">
      {/* Header section */}
      <header className="border-b border-cyber-magenta/15 bg-cyber-bg-darker/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-cyber-magenta/10 text-cyber-magenta border border-cyber-magenta/25">
              <Settings className="w-5 h-5 animate-spin" />
            </span>
            <div>
              <h1 className="font-orbitron font-extrabold text-lg text-white tracking-widest text-glow-magenta uppercase">
                SCORESPHERE ADMIN CONSOLE
              </h1>
              <div className="flex items-center gap-2 mt-0.5 font-mono text-[9px] text-cyber-magenta tracking-wider">
                <span className={`w-1.5 h-1.5 rounded-full ${realtimeStatus === "connected" ? "bg-cyber-green animate-ping" : realtimeStatus === "connecting" ? "bg-cyber-yellow animate-pulse" : "bg-cyber-red"}`} />
                {realtimeStatus === "connected" ? "⚡ LIVE SYNC" : realtimeStatus === "connecting" ? "SYNCING..." : "OFFLINE"} • ROOT_SESSION_ACTIVE
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <CyberButton
              variant={announceResults ? "red" : "green"}
              size="sm"
              onClick={handleToggleBroadcast}
              disabled={actionLoading}
              className="flex items-center gap-1.5"
            >
              {announceResults ? "🔐 LOCK RESULTS" : "📢 PUBLISH RESULTS"}
            </CyberButton>

            <CyberButton
              variant="magenta"
              size="sm"
              onClick={() => router.push("/results")}
              className="flex items-center gap-1.5"
            >
              🏆 LEADERBOARD
            </CyberButton>

            <CyberButton
              variant="magenta"
              size="sm"
              onClick={() => fetchDbData(false)}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> REFRESH
            </CyberButton>

            <CyberButton
              variant="red"
              size="sm"
              onClick={handleAdminLogout}
              className="flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" /> DE-AUTHORIZE
            </CyberButton>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Navigation Tabs list (Col 1-3) */}
        <section className="lg:col-span-3 flex flex-col gap-2">
          {[
            { id: "overview", label: "📊 MASTER OVERVIEW", icon: <Grid className="w-4 h-4" /> },
            { id: "judges", label: "👥 JUDGES TELEMETRY", icon: <Users className="w-4 h-4" /> },
            { id: "teams", label: "📂 TEAM DIRECTORIES", icon: <Layers className="w-4 h-4" /> },
            { id: "criteria", label: "⚙️ SCORING PARAMETERS", icon: <Settings className="w-4 h-4" /> },
            { id: "leaderboard", label: "🏆 LEADERBOARD FEED", icon: <Trophy className="w-4 h-4" /> },
            { id: "matrix", label: "🧮 MASTER MATRIX", icon: <Radio className="w-4 h-4" /> },
            { id: "system", label: "🚨 BROADCAST & REBOOT", icon: <Radio className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                w-full text-left p-3.5 font-orbitron font-bold text-xs tracking-wider transition-all duration-300 flex items-center gap-3 border
                ${activeTab === tab.id
                  ? "bg-cyber-magenta/15 border-l-4 border-cyber-magenta text-white shadow-[0_0_12px_rgba(217,70,239,0.15)]"
                  : "bg-cyber-bg-darker/60 hover:bg-cyber-magenta/5 border-l-2 border-gray-800 text-gray-400 hover:text-gray-200"
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </section>

        {/* Dynamic Display Area (Col 4-12) */}
        <section className="lg:col-span-9 flex flex-col gap-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="flex flex-col gap-6">
              {/* Telemetry diagnostics counts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="cyber-glass border border-cyber-magenta/15 p-5 flex flex-col gap-2 relative">
                  <span className="absolute top-0 right-0 w-2 h-2 bg-cyber-magenta" />
                  <span className="font-mono text-[9px] text-gray-500 uppercase">ACTIVE EVALUATING JURISTS</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-orbitron font-extrabold text-3xl text-white text-glow-magenta">{judges.length}</span>
                    <span className="text-xs text-gray-500 font-mono uppercase">ONLINE REGISTERED</span>
                  </div>
                </div>

                <div className="cyber-glass border border-cyber-magenta/15 p-5 flex flex-col gap-2 relative">
                  <span className="absolute top-0 right-0 w-2 h-2 bg-cyber-magenta" />
                  <span className="font-mono text-[9px] text-gray-500 uppercase">DYNAMIC TEAM PROTOTYPES</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-orbitron font-extrabold text-3xl text-white text-glow-magenta">{teams.length}</span>
                    <span className="text-xs text-gray-500 font-mono uppercase">QUEUED IN MATRIX</span>
                  </div>
                </div>

                <div className="cyber-glass border border-cyber-magenta/15 p-5 flex flex-col gap-2 relative">
                  <span className="absolute top-0 right-0 w-2 h-2 bg-cyber-magenta" />
                  <span className="font-mono text-[9px] text-gray-500 uppercase">TABULATION COMPLETION DIAGNOSTIC</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-orbitron font-extrabold text-3xl text-white text-glow-magenta">{telemetryProgressPercent}%</span>
                    <span className="text-xs text-gray-500 font-mono uppercase">{submittedScoresCount}/{expectedScoresCount} SCOREFILES</span>
                  </div>
                </div>
              </div>

              {/* Progress bar visualizer */}
              <div className="cyber-glass border border-cyber-magenta/15 p-6 flex flex-col gap-3">
                <div className="flex justify-between font-mono text-[10px] text-gray-400">
                  <span className="uppercase tracking-widest text-cyber-magenta font-bold">📡 CORE SYNCHRONIZER METRIC STATUS</span>
                  <span>{telemetryProgressPercent}% PROGRESS</span>
                </div>
                <div className="w-full bg-gray-950 h-3 border border-white/5 relative overflow-hidden">
                  <div 
                    className="h-full absolute left-0 top-0 bg-cyber-magenta transition-all duration-500"
                    style={{ width: `${telemetryProgressPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 font-mono leading-relaxed mt-1 uppercase">
                  ⚡ STATUS: {telemetryProgressPercent === 100 ? "EVALUATION COMPLETE. BROADCAST STAGE CLEAR." : "WAITING FOR ACTIVE EVALUATION LOGS BY JURISTS..."}
                </p>
              </div>

              {/* Leaderboard status */}
              <div className="cyber-glass border border-cyber-magenta/15 p-6 flex flex-col gap-3">
                <h3 className="font-orbitron text-xs font-bold text-cyber-magenta uppercase border-b border-cyber-magenta/15 pb-2 mb-2 tracking-wide">
                  LEADERBOARD DISCLOSURE CONTROL
                </h3>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-3.5 h-3.5 rounded-full ${announceResults ? "bg-cyber-green animate-pulse" : "bg-cyber-red"}`} />
                    <span className="font-mono text-sm text-gray-300 font-bold uppercase">
                      PUBLIC LEADERBOARD: {announceResults ? "📢 TRANSMITTING ACTIVE" : "🔐 ENCRYPTED BLOCKADE"}
                    </span>
                  </div>
                  <CyberButton
                    variant={announceResults ? "red" : "green"}
                    size="sm"
                    onClick={handleToggleBroadcast}
                    disabled={actionLoading}
                  >
                    {announceResults ? "DE-ACTIVATE BROADCAST" : "ACTIVATE PUBLIC BROADCAST"}
                  </CyberButton>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: JUDGES MANAGEMENT */}
          {activeTab === "judges" && (
            <div className="cyber-glass border border-cyber-magenta/15 p-6 flex flex-col gap-6">
              <h3 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase border-b border-cyber-magenta/15 pb-2.5">
                👥 JURIST CREDENTIAL MANAGERS
              </h3>

              {/* Form Add Judge */}
              <form onSubmit={handleAddJudge} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-cyber-bg-darker/50 p-4 border border-cyber-magenta/10">
                <div className="md:col-span-2">
                  <span className="font-mono text-[9px] text-cyber-magenta font-bold uppercase tracking-wider block mb-1">
                    ➕ INGEST NEW JURIST NODE
                  </span>
                </div>
                <CyberInput
                  variant="magenta"
                  label="JURIST NAME"
                  placeholder="e.g. Dr. Ananya Rao"
                  value={newJudgeName}
                  onChange={(e) => setNewJudgeName(e.target.value)}
                  disabled={actionLoading}
                  required
                />
                <CyberInput
                  variant="magenta"
                  label="DESIGNATION / INSTITUTION"
                  placeholder="e.g. Professor, CSE"
                  value={newJudgeDesg}
                  onChange={(e) => setNewJudgeDesg(e.target.value)}
                  disabled={actionLoading}
                  required
                />
                <CyberInput
                  variant="magenta"
                  label="ASSIGN LOGIN ID (USERNAME)"
                  placeholder="e.g. judge1"
                  value={newJudgeUser}
                  onChange={(e) => setNewJudgeUser(e.target.value)}
                  disabled={actionLoading}
                  required
                />
                <CyberInput
                  variant="magenta"
                  label="ASSIGN ACCESS KEY (PASSWORD)"
                  placeholder="e.g. score1"
                  value={newJudgePass}
                  onChange={(e) => setNewJudgePass(e.target.value)}
                  disabled={actionLoading}
                  required
                />
                <div className="md:col-span-2 flex justify-end mt-2">
                  <CyberButton
                    type="submit"
                    variant="magenta"
                    size="sm"
                    disabled={actionLoading}
                  >
                    <Plus className="w-3.5 h-3.5" /> REGISTER JURIST
                  </CyberButton>
                </div>
              </form>

              {/* Judges List */}
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">
                  LISTED ONLINE JURISTS ({judges.length})
                </span>
                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {judges.length === 0 ? (
                    <p className="text-xs font-mono italic text-gray-500">No active judges configured.</p>
                  ) : (
                    judges.map((j) => (
                      <div key={j.id} className="bg-cyber-bg-darker/60 border border-gray-800 p-3 flex justify-between items-center hover:border-cyber-magenta/20 transition-all duration-300">
                        <div className="flex flex-col gap-1">
                          <span className="font-orbitron font-bold text-xs text-white uppercase">{j.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono uppercase">{j.designation}</span>
                          <div className="flex gap-4 font-mono text-[9px] text-cyber-magenta mt-1 uppercase">
                            <span>USER: {j.username}</span>
                            <span>PASS: {j.password}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveJudge(j.id)}
                          className="p-2 text-gray-500 hover:text-cyber-red hover:bg-cyber-red/10 border border-transparent hover:border-cyber-red/20 transition-all duration-300 cursor-pointer"
                          title="Purge Jurist from system"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TEAMS */}
          {activeTab === "teams" && (
            <div className="cyber-glass border border-cyber-magenta/15 p-6 flex flex-col gap-6">
              <h3 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase border-b border-cyber-magenta/15 pb-2.5">
                📂 TEAM REPOSITORIES
              </h3>

              {/* Form Add Team */}
              <form onSubmit={handleAddTeam} className="flex gap-4 items-end bg-cyber-bg-darker/50 p-4 border border-cyber-magenta/10">
                <div className="flex-grow">
                  <CyberInput
                    variant="magenta"
                    label="PROTOTYPE TEAM IDENTIFIER"
                    placeholder="e.g. Team Gamma (T6)"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    disabled={actionLoading}
                    required
                  />
                </div>
                <CyberButton
                  type="submit"
                  variant="magenta"
                  size="md"
                  disabled={actionLoading}
                  className="shrink-0 mb-1"
                >
                  <Plus className="w-4 h-4" /> REGISTER TEAM
                </CyberButton>
              </form>

              {/* Team list */}
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">
                  REGISTERED DIRECTORIES ({teams.length})
                </span>
                <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
                  {teams.length === 0 ? (
                    <p className="text-xs font-mono italic text-gray-500">No teams registered in local storage.</p>
                  ) : (
                    teams.map((t) => {
                      const complCount = scores.filter((s) => s.teamId === t.id).length;
                      const isDq = t.name.startsWith("[DISQUALIFIED]");
                      
                      return (
                        <div key={t.id} className="bg-cyber-bg-darker/60 border border-gray-800 p-3 flex justify-between items-center hover:border-cyber-magenta/20 transition-all duration-300">
                          <div className="flex flex-col gap-0.5">
                            <span className={`font-orbitron font-bold text-xs uppercase ${isDq ? "text-cyber-red line-through" : "text-white"}`}>{t.name}</span>
                            <span className="text-[9px] text-gray-500 font-mono uppercase">
                              COMPLETED EVALS: {complCount}/{judges.length}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDisqualifyTeam(t.id, t.name, isDq)}
                              className={`p-2 border border-transparent transition-all duration-300 cursor-pointer ${isDq ? "text-cyber-green hover:bg-cyber-green/10 hover:border-cyber-green/20" : "text-cyber-yellow hover:bg-cyber-yellow/10 hover:border-cyber-yellow/20"}`}
                              title={isDq ? "Reinstate Team" : "Disqualify Team"}
                            >
                              <AlertOctagon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveTeam(t.id)}
                              className="p-2 text-gray-500 hover:text-cyber-red hover:bg-cyber-red/10 border border-transparent hover:border-cyber-red/20 transition-all duration-300 cursor-pointer"
                              title="Eliminate Team from system"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CRITERIA & TIMER */}
          {activeTab === "criteria" && (
            <div className="flex flex-col gap-6">
              {/* Scoring parameters manager card */}
              <div className="cyber-glass border border-cyber-magenta/15 p-6 flex flex-col gap-6">
                <div className="flex justify-between items-center border-b border-cyber-magenta/15 pb-2.5">
                  <h3 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase">
                    ⚙️ SCORING PARAMETERS MANAGER
                  </h3>
                  <CyberButton
                    variant="magenta"
                    size="sm"
                    onClick={handleSaveCriteria}
                    disabled={actionLoading}
                  >
                    <Save className="w-3.5 h-3.5" /> SAVE CRITERIA
                  </CyberButton>
                </div>

                <div className="bg-cyber-magenta/5 border border-cyber-magenta/20 p-3 text-xs font-mono text-gray-400">
                  ⚡ PROTOCOL: ADJUSTING, ADDING, OR PURGING EVALUATION PARAMETERS CHANGES THE SCORING RATIO MATRIX IN REAL-TIME. RENAMING AND INDIVIDUAL ELEMENT MANAGEMENT IS MODIFIED BELOW.
                </div>

                {/* Add new criteria form */}
                <form onSubmit={handleAddCriteria} className="flex gap-3 items-end bg-cyber-bg-darker/50 p-3 border border-cyber-magenta/10">
                  <div className="flex-grow">
                    <CyberInput
                      variant="magenta"
                      label="ADD NEW EVALUATION PARAMETER"
                      placeholder="e.g. Code Aesthetics & Formatting"
                      value={newCriteriaName}
                      onChange={(e) => setNewCriteriaName(e.target.value)}
                      disabled={actionLoading}
                      required
                    />
                  </div>
                  <CyberButton
                    type="submit"
                    variant="magenta"
                    size="sm"
                    disabled={actionLoading}
                    className="shrink-0 mb-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> ADD
                  </CyberButton>
                </form>

                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {criteria.length === 0 ? (
                    <p className="text-xs font-mono italic text-gray-500 text-center py-4">No active parameters. Please add one above.</p>
                  ) : (
                    criteria.map((c, index) => (
                      <div key={c.id} className="flex gap-4 items-center bg-cyber-bg-darker/60 border border-gray-800 p-3 hover:border-cyber-magenta/10 transition-colors duration-200">
                        <span className="font-mono text-xs font-bold text-cyber-magenta w-8 shrink-0">
                          CR-{index + 1}
                        </span>
                        <div className="flex-grow">
                          <input
                            type="text"
                            value={c.name}
                            onChange={(e) => handleCriteriaChange(index, e.target.value)}
                            className="w-full bg-gray-950/80 text-gray-100 font-mono text-xs px-3 py-1.5 border border-gray-800 focus:border-cyber-magenta outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCriteria(c.id)}
                          className="p-1.5 text-gray-500 hover:text-cyber-red hover:bg-cyber-red/10 border border-transparent hover:border-cyber-red/20 transition-all duration-300 cursor-pointer"
                          title="Purge parameter"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Dynamic Presentation Timer Limit Configuration Card */}
              <div className="cyber-glass border border-cyber-magenta/15 p-6 flex flex-col gap-5">
                <div className="flex justify-between items-center border-b border-cyber-magenta/15 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyber-magenta" />
                    <h3 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase">
                      ⏲️ PRESENTATION TIME LIMIT
                    </h3>
                  </div>
                  <CyberButton
                    variant="magenta"
                    size="sm"
                    onClick={handleSaveTimer}
                    disabled={actionLoading}
                  >
                    <Save className="w-3.5 h-3.5" /> SAVE TIME LIMIT
                  </CyberButton>
                </div>

                <div className="bg-cyber-magenta/5 border border-cyber-magenta/20 p-3 text-xs font-mono text-gray-400">
                  ⚡ PROTOCOL: ADJUSTING THE TIME LIMIT SETS THE COUNTDOWN CLOCK FOR ALL ONLINE JURISTS INSTANTLY. TIME LIMIT EXPRESSED IN MINUTES.
                </div>

                <div className="flex gap-4 items-end bg-cyber-bg-darker/50 p-4 border border-cyber-magenta/10">
                  <div className="flex-grow">
                    <CyberInput
                      variant="magenta"
                      label="PRESENTATION LIMIT (MINUTES)"
                      type="number"
                      min="1"
                      max="60"
                      value={timerDuration}
                      onChange={(e) => setTimerDuration(parseInt(e.target.value) || 1)}
                      disabled={actionLoading}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MASTER MATRIX GRID */}
          {activeTab === "matrix" && (
            <div className="cyber-glass border border-cyber-magenta/15 p-6 flex flex-col gap-6">
              <div className="flex justify-between items-center border-b border-cyber-magenta/15 pb-2.5">
                <h3 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase">
                  🧮 JURY DATA SPREADSHEET MATRIX
                </h3>
                {teams.length > 0 && (
                  <CyberButton
                    variant="cyan"
                    size="sm"
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> EXPORT CSV
                  </CyberButton>
                )}
              </div>

              {teams.length === 0 ? (
                <p className="text-xs font-mono italic text-gray-500 text-center py-6">No teams registered to construct matrix.</p>
              ) : (
                <div className="overflow-x-auto border border-gray-800">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="bg-cyber-bg-darker border-b border-gray-800">
                        <th className="p-3 font-orbitron text-gray-400 font-bold uppercase">TEAM NAME</th>
                        {judges.map((j) => (
                          <th key={j.id} className="p-3 font-orbitron text-gray-400 font-bold uppercase truncate max-w-[120px]" title={j.name}>
                            {j.name.split(" ")[0]}..
                          </th>
                        ))}
                        <th className="p-3 font-orbitron text-cyber-magenta font-bold uppercase text-right">AVG RATIO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((t) => {
                        const teamScores = scores.filter((s) => s.teamId === t.id);
                        const averageScore = teamScores.length > 0
                          ? parseFloat((teamScores.reduce((sum, s) => sum + s.totalScore, 0) / teamScores.length).toFixed(2))
                          : 0;

                        return (
                          <tr key={t.id} className="border-b border-gray-900 hover:bg-white/5 transition-colors duration-200">
                            <td className="p-3 font-bold text-white uppercase">{t.name}</td>
                            
                            {judges.map((j) => {
                              const match = teamScores.find((s) => s.judgeId === j.id);
                              
                              return (
                                <td key={j.id} className="p-3">
                                  {match ? (
                                    <span className="text-cyber-cyan font-bold text-glow-cyan">
                                      {match.totalScore}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-cyber-yellow/60 font-semibold animate-pulse uppercase">
                                      PENDING
                                    </span>
                                  )}
                                </td>
                              );
                            })}

                            <td className="p-3 text-right font-orbitron font-extrabold text-sm text-cyber-magenta text-glow-magenta">
                              {averageScore}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5.5: LEADERBOARD RENDERING VIEW */}
          {activeTab === "leaderboard" && (
            <div className="cyber-glass border border-cyber-magenta/15 p-6 flex flex-col gap-6">
              <h3 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase border-b border-cyber-magenta/15 pb-2.5">
                🏆 LIVE RANKED LEADERBOARD
              </h3>
              
              <div className="flex flex-col gap-4">
                {leaderboard.length === 0 ? (
                  <p className="text-xs font-mono italic text-gray-500 text-center py-6">No scores compiled yet to rank teams.</p>
                ) : (
                  leaderboard.map((entry) => {
                    const isFirst = entry.rank === 1;
                    const isSecond = entry.rank === 2;
                    const isThird = entry.rank === 3;
                    
                    const rankColor = isFirst 
                      ? "border-cyber-yellow text-cyber-yellow bg-cyber-yellow/10 shadow-[0_0_10px_rgba(234,179,8,0.1)]" 
                      : isSecond 
                        ? "border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10 shadow-[0_0_10px_rgba(6,182,212,0.1)]" 
                        : isThird 
                          ? "border-cyber-magenta text-cyber-magenta bg-cyber-magenta/10 shadow-[0_0_10px_rgba(217,70,239,0.1)]"
                          : "border-gray-800 text-gray-400 bg-gray-900/30";

                    return (
                      <div key={entry.teamId} className="bg-cyber-bg-darker/60 border border-gray-800 p-4 flex justify-between items-center hover:border-cyber-magenta/20 transition-all duration-300">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 flex items-center justify-center font-orbitron font-extrabold text-sm border clip-cyber ${rankColor}`}>
                            #{entry.rank}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-orbitron font-bold text-xs text-white uppercase">{entry.teamName}</span>
                            <span className="text-[9px] text-gray-500 font-mono uppercase">
                              Scored by {entry.judgeSubmissions.length} Jurists
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[9px] text-gray-500 font-mono uppercase block">AVERAGE SCORE</span>
                          <span className={`font-orbitron font-extrabold text-base tracking-wider ${
                            isFirst ? "text-cyber-yellow" : isSecond ? "text-cyber-cyan" : "text-cyber-magenta"
                          }`}>
                            {entry.averageScore}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 6: BROADCAST CONTROL & SYSTEM RESET */}
          {activeTab === "system" && (
            <div className="flex flex-col gap-6">
              {/* Broadcast Switcher card */}
              <div className="cyber-glass border border-cyber-magenta/15 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-cyber-magenta/15 pb-2.5">
                  <Radio className="w-5 h-5 text-cyber-magenta" />
                  <h3 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase">
                    PUBLIC RESULTS BROADCASTER
                  </h3>
                </div>
                <p className="text-xs text-gray-400 font-sans leading-relaxed">
                  Broadcasting results unlocks `/results` across the intranet, sorting teams by average score across judges. De-activating instantly restores AES encryption blockade.
                </p>

                <div className="flex items-center justify-between bg-cyber-bg-darker/60 border border-gray-800 p-4 mt-1.5">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className={`w-2.5 h-2.5 rounded-full ${announceResults ? "bg-cyber-green" : "bg-cyber-red"}`} />
                    <span className="text-white uppercase font-bold">
                      TRANSMISSION FEED: {announceResults ? "ACTIVE BROADCASTING" : "ENCRYPTED BLOCK"}
                    </span>
                  </div>
                  <CyberButton
                    variant={announceResults ? "red" : "green"}
                    size="sm"
                    onClick={handleToggleBroadcast}
                    disabled={actionLoading}
                  >
                    {announceResults ? "DISCONNECT FEED" : "TRANSMIT ON SIGNAL"}
                  </CyberButton>
                </div>
              </div>

              {/* Destructive factory reboot */}
              <div className="cyber-glass border border-cyber-red/25 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-cyber-red/20 pb-2.5">
                  <AlertOctagon className="w-5 h-5 text-cyber-red" />
                  <h3 className="font-orbitron text-sm font-bold text-cyber-red tracking-wide uppercase">
                    SYSTEM RESET & RE-BOOT CODES
                  </h3>
                </div>
                <p className="text-xs text-gray-400 font-sans leading-relaxed">
                  Erase all active registers, reset scoring criteria to defaults, purge jury credentials lists, and restore system state back to factory benchmarks.
                </p>

                <div className="flex justify-end mt-2">
                  <CyberButton
                    variant="red"
                    size="md"
                    onClick={handleFactoryReset}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 shadow-[0_0_12px_rgba(244,63,94,0.1)] border-cyber-red/30"
                  >
                    🚨 TRIGGER SYSTEM DECONSTRUCT
                  </CyberButton>
                </div>
              </div>
            </div>
          )}

        </section>

      </main>
    </div>
  );
}
