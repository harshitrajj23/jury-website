"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Users, 
  Settings, 
  Trophy, 
  LogOut, 
  Trash2, 
  Save, 
  Radio, 
  Grid, 
  ListFilter, 
  Download, 
  Clock, 
  AlertOctagon, 
  KeyRound,
  FileSpreadsheet,
  Layers,
  PlusCircle,
  Edit3,
  Calendar
} from "lucide-react";
import { 
  getJudges, 
  getTeams, 
  getScores, 
  getConfig, 
  getLeaderboard,
  addJudge, 
  removeJudge, 
  addTeam, 
  removeTeam, 
  toggleDisqualifyTeam, 
  updateCriteria, 
  toggleAnnounceResults,
  updateTimerDuration,
  resetDatabase,
  initDatabase,
  getEvents,
  createEvent,
  updateEvent
} from "@/lib/db";
import { Judge, Team, ScoringCriteria, ScoreRecord, LeaderboardEntry, EventItem } from "@/lib/types";
import { useRealtimeSync } from "@/lib/useRealtimeSync";
import CyberButton from "@/components/CyberButton";
import CyberInput from "@/components/CyberInput";

export default function AdminConsolePage() {
  // Authentication & Security
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Events State
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("default_event");
  const [currentEvent, setCurrentEvent] = useState<EventItem | null>(null);

  // App Database States (Event-scoped)
  const [judges, setJudges] = useState<Judge[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [criteria, setCriteria] = useState<ScoringCriteria[]>([]);
  const [announceResults, setAnnounceResults] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  // Timer State with dirty flag to prevent background poll clobbering
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timerInputStr, setTimerInputStr] = useState("5");
  const isTimerDirtyRef = useRef(false);

  // UI Tabs: 'overview' | 'events' | 'judges' | 'teams' | 'criteria' | 'matrix' | 'leaderboard' | 'system'
  const [activeTab, setActiveTab] = useState("overview");

  // Dynamic Add Forms state
  const [newJudgeName, setNewJudgeName] = useState("");
  const [newJudgeDesg, setNewJudgeDesg] = useState("");
  const [newJudgeUser, setNewJudgeUser] = useState("");
  const [newJudgePass, setNewJudgePass] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newCriteriaName, setNewCriteriaName] = useState("");

  // Event Creation / Editing state
  const [newEventName, setNewEventName] = useState("");
  const [newEventSubtitle, setNewEventSubtitle] = useState("");
  const [newEventOrganizer, setNewEventOrganizer] = useState("");
  const [newEventLogo, setNewEventLogo] = useState("");
  const [newEventTimer, setNewEventTimer] = useState("5");

  // Loading indicator states
  const [dbLoading, setDbLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const isInitialLoadRef = useRef(true);
  const selectedEventIdRef = useRef("default_event");

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  useEffect(() => {
    initDatabase();
    const session = sessionStorage.getItem("admin_session");
    if (session === "authorized") {
      setIsAdmin(true);
      fetchDbData(selectedEventIdRef.current, false);
    } else {
      setDbLoading(false);
    }
  }, []);

  const fetchDbData = async (eventId: string = selectedEventIdRef.current, isBackground = false) => {
    if (!isBackground && isInitialLoadRef.current) {
      setDbLoading(true);
    }
    try {
      const [eventsList, jList, tList, sList, config, lList] = await Promise.all([
        getEvents(),
        getJudges(eventId),
        getTeams(eventId),
        getScores(eventId),
        getConfig(eventId),
        getLeaderboard(eventId),
      ]);

      setEvents(eventsList || []);
      const matchedEv = eventsList.find((e) => e.id === eventId) || config.event || null;
      setCurrentEvent(matchedEv);

      setJudges(jList || []);
      setTeams(tList || []);
      setScores(sList || []);
      setCriteria(config?.criteriaList || []);
      setAnnounceResults(Boolean(config?.announceResults));
      setLeaderboard(lList || []);

      const serverMins = Math.round((config?.timerDuration || 300) / 60);
      setTimerMinutes(serverMins);
      // Only sync input value if user is not actively editing it
      if (!isTimerDirtyRef.current) {
        setTimerInputStr(String(serverMins));
      }

      isInitialLoadRef.current = false;
    } catch (err) {
      console.error("Transmission breakdown:", err);
    } finally {
      setDbLoading(false);
    }
  };

  // Realtime WebSocket sync scoped to current event
  const handleRealtimeChange = useCallback(() => {
    if (isAdmin) {
      fetchDbData(selectedEventIdRef.current, true);
    }
  }, [isAdmin]);

  const realtimeStatus = useRealtimeSync({
    tables: ["Score", "Team", "User", "Criteria", "Settings", "Event"],
    eventId: selectedEventId,
    onDataChange: handleRealtimeChange,
    enabled: isAdmin,
    intervalMs: 20000,
  });

  const handleEventSwitch = (newId: string) => {
    setSelectedEventId(newId);
    selectedEventIdRef.current = newId;
    isTimerDirtyRef.current = false;
    fetchDbData(newId, false);
  };

  // ==============================================================
  // TIMER HANDLERS (REQUIREMENT 3 FIX)
  // ==============================================================
  const handleTimerInputChange = (val: string) => {
    isTimerDirtyRef.current = true;
    setTimerInputStr(val);
  };

  const handleTimerPreset = (mins: number) => {
    isTimerDirtyRef.current = true;
    setTimerInputStr(String(mins));
  };

  const handleSaveTimer = async () => {
    const mins = parseInt(timerInputStr.trim(), 10);
    if (isNaN(mins) || mins < 1 || mins > 60) {
      alert("FAIL: PRESENTATION TIME LIMIT MUST BE AN INTEGER BETWEEN 1 AND 60 MINUTES.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await updateTimerDuration(mins * 60, selectedEventId);
      if (!res.success) {
        alert(`FAIL: TIMER SETTING TRANSMISSION FAILURE.\n\n${res.error}`);
        return;
      }
      setTimerMinutes(mins);
      isTimerDirtyRef.current = false;
      alert(`SYSTEM STATUS: TIME LIMIT SET TO ${mins} MINUTES FOR ${currentEvent?.name || "SELECTED EVENT"}.`);
      await fetchDbData(selectedEventId, false);
    } catch (err: any) {
      alert(`FAIL: TIMER SETTING TRANSMISSION FAILURE. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  // ==============================================================
  // AUTHENTICATION
  // ==============================================================
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
    fetchDbData(selectedEventId, false);
    setAuthLoading(false);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem("admin_session");
    setIsAdmin(false);
  };

  // ==============================================================
  // EVENT MANAGEMENT
  // ==============================================================
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    setActionLoading(true);
    try {
      const mins = parseInt(newEventTimer, 10) || 5;
      const res = await createEvent({
        name: newEventName.trim(),
        subtitle: newEventSubtitle.trim(),
        organizer: newEventOrganizer.trim(),
        logo: newEventLogo.trim() || "/pals-logo.svg",
        timerDuration: mins * 60,
      });

      if (!res.success || !res.data) {
        alert(`FAIL: EVENT CREATION FAILED.\n\n${res.error}`);
        return;
      }

      setNewEventName("");
      setNewEventSubtitle("");
      setNewEventOrganizer("");
      setNewEventLogo("");
      alert(`✅ EVENT "${res.data.name}" CREATED SUCCESSFULLY.`);
      handleEventSwitch(res.data.id);
    } catch (err: any) {
      alert(`FAIL: EVENT CREATION ERROR: ${err?.message || "Database error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ==============================================================
  // JUDGES & TEAMS MANAGEMENT
  // ==============================================================
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
        eventId: selectedEventId,
      }, selectedEventId);

      if (!res.success) {
        alert(`FAIL: JUDGE REGISTRATION REJECTED.\n\n${res.error}`);
        return;
      }
      setNewJudgeName("");
      setNewJudgeDesg("");
      setNewJudgeUser("");
      setNewJudgePass("");
      await fetchDbData(selectedEventId, false);
      alert("✅ JUDGE REGISTERED SUCCESSFULLY FOR CURRENT EVENT.");
    } catch (err: any) {
      alert(`FAIL: JUDGE REGISTRATION REJECTED. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveJudge = async (id: string) => {
    if (!confirm("WARNING: ALL SCORES SUBMITTED BY THIS JUDGE WILL BE ERASED. PROCEED?")) return;
    setActionLoading(true);
    try {
      const res = await removeJudge(id);
      if (!res.success) {
        alert(`FAIL: JUDGE DELETION ABORTED.\n\n${res.error}`);
        return;
      }
      await fetchDbData(selectedEventId, false);
    } catch (err: any) {
      alert(`FAIL: JUDGE DELETION ABORTED. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setActionLoading(true);
    try {
      const res = await addTeam(newTeamName.trim(), selectedEventId);
      if (!res.success) {
        alert(`FAIL: TEAM REGISTRATION REJECTED.\n\n${res.error}`);
        return;
      }
      setNewTeamName("");
      await fetchDbData(selectedEventId, false);
      alert("✅ TEAM REGISTERED SUCCESSFULLY FOR CURRENT EVENT.");
    } catch (err: any) {
      alert(`FAIL: TEAM REGISTRATION REJECTED. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveTeam = async (id: string) => {
    if (!confirm("WARNING: REMOVING THIS TEAM WILL DELETE ALL RECEIVED JUDGING SCORES. PROCEED?")) return;
    setActionLoading(true);
    try {
      const res = await removeTeam(id);
      if (!res.success) {
        alert(`FAIL: TEAM ELIMINATION FAILED.\n\n${res.error}`);
        return;
      }
      await fetchDbData(selectedEventId, false);
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
      await fetchDbData(selectedEventId, false);
    } catch (err: any) {
      alert(`FAIL: TEAM DISQUALIFICATION STATE TOGGLE FAILED. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  // ==============================================================
  // CRITERIA MANAGEMENT
  // ==============================================================
  const handleCriteriaChange = (index: number, newName: string) => {
    const updated = [...criteria];
    updated[index].name = newName;
    setCriteria(updated);
  };

  const handleRemoveCriteria = (id: string) => {
    if (criteria.length <= 1) {
      alert("FAIL: AT LEAST ONE SCORING CRITERION MUST PERSIST.");
      return;
    }
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddCriteria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCriteriaName.trim()) return;
    const newCriteria: ScoringCriteria = {
      id: `c_${selectedEventId}_${Date.now()}`,
      name: newCriteriaName.trim(),
      eventId: selectedEventId,
    };
    setCriteria((prev) => [...prev, newCriteria]);
    setNewCriteriaName("");
  };

  const handleSaveCriteria = async () => {
    setActionLoading(true);
    try {
      const res = await updateCriteria(criteria, selectedEventId);
      if (!res.success) {
        alert(`FAIL: CONFIG TRANSMISSION FAILURE.\n\n${res.error}`);
        return;
      }
      alert("SYSTEM STATUS: SCORING PARAMETERS UPDATED FOR CURRENT EVENT.");
    } catch (err: any) {
      alert(`FAIL: CONFIG TRANSMISSION FAILURE. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  // ==============================================================
  // BROADCAST & SYSTEM RESET
  // ==============================================================
  const handleToggleBroadcast = async () => {
    setActionLoading(true);
    try {
      const nextState = !announceResults;
      const res = await toggleAnnounceResults(nextState, selectedEventId);
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

  const handleFactoryReset = async () => {
    if (!confirm(`🚨 RESET SCORES FOR "${currentEvent?.name || "SELECTED EVENT"}"? THIS WILL ERASE ALL SCORES SUBMITTED FOR THIS EVENT ONLY. PROCEED?`)) return;
    setActionLoading(true);
    try {
      const res = await resetDatabase(selectedEventId);
      if (!res.success) {
        alert(`FAIL: RESET TRIGGER REJECTED.\n\n${res.error}`);
        return;
      }
      await fetchDbData(selectedEventId, false);
      alert("✅ EVENT EVALUATIONS RESET SUCCESSFULLY.");
    } catch (err: any) {
      alert(`FAIL: RESET ERROR (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  // ==============================================================
  // CSV EXPORT (EVENT SCOPED)
  // ==============================================================
  const handleExportCSV = () => {
    if (teams.length === 0) return;

    const headers = [
      "Team ID",
      "Team Name",
      "Project Name",
      "Event ID",
      ...judges.map((j) => `${j.name} (${j.email || j.username})`),
      "Raw Average Score",
      "Weighted Average Score"
    ];

    const rows = teams.map((team) => {
      const teamScores = scores.filter((s) => s.teamId === team.id);
      
      const judgeCols = judges.map((j) => {
        const found = teamScores.find((s) => s.judgeId === j.id);
        return found ? found.totalScore : "NOT_SCORED";
      });

      const lbEntry = leaderboard.find((l) => l.teamId === team.id);

      return [
        `"${team.id}"`,
        `"${team.name}"`,
        `"${team.projectName || team.name}"`,
        `"${selectedEventId}"`,
        ...judgeCols,
        lbEntry?.rawAverageScore ?? "0",
        lbEntry?.averageScore ?? "0"
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `jury_matrix_${selectedEventId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==============================================================
  // LOGIN SCREEN
  // ==============================================================
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 relative font-mono">
        <div className="w-full max-w-md cyber-glass p-8 border border-cyber-magenta/30 flex flex-col gap-6 relative">
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-cyber-magenta" />
          <span className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-cyber-magenta" />

          <div className="text-center border-b border-cyber-magenta/15 pb-4">
            <h1 className="font-orbitron font-extrabold text-xl text-white tracking-widest text-glow-magenta uppercase">
              MASTER CONTROL TERMINAL
            </h1>
            <p className="text-[10px] text-gray-500 uppercase mt-1">
              AUTHORIZED PERSONNEL ONLY • ACCESS KEY ENCRYPTED
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
            <div className="relative">
              <KeyRound className="absolute right-3 bottom-3 w-4 h-4 text-cyber-magenta/50" />
              <CyberInput
                variant="magenta"
                label="ADMIN SECURITY KEY"
                type="password"
                placeholder="••••••••"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                disabled={authLoading}
                required
              />
            </div>

            {authError && (
              <div className="bg-cyber-red/10 border border-cyber-red/30 p-2.5 text-xs text-cyber-red font-bold">
                ⚠️ {authError}
              </div>
            )}

            <CyberButton type="submit" variant="magenta" fullWidth disabled={authLoading}>
              {authLoading ? "VALIDATING CODES..." : "AUTHENTICATE"}
            </CyberButton>
          </form>
        </div>
      </div>
    );
  }

  // ==============================================================
  // MAIN ADMIN DASHBOARD
  // ==============================================================
  return (
    <div className="min-h-screen flex flex-col relative pb-12 font-sans overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-cyber-magenta/20 bg-cyber-bg-darker/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Left: Branding & Event Dropdown */}
          <div className="flex items-center gap-3 min-w-0">
            {currentEvent?.logo ? (
              <div className="p-1 bg-black/40 border border-cyber-magenta/30 flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={currentEvent.logo} 
                  alt={currentEvent.name} 
                  className="h-8 max-w-[110px] object-contain"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              </div>
            ) : (
              <span className="p-2 bg-cyber-magenta/10 text-cyber-magenta border border-cyber-magenta/30 shrink-0">
                <Settings className="w-5 h-5 animate-spin" />
              </span>
            )}

            <div className="min-w-0">
              <h1 className="font-orbitron font-extrabold text-base sm:text-lg text-white tracking-widest text-glow-magenta uppercase truncate">
                MASTER ADMIN CONTROL
              </h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${realtimeStatus === "connected" ? "bg-cyber-green animate-ping" : "bg-cyber-yellow"}`} />
                <span className="font-mono text-[9px] text-cyber-magenta tracking-wider">
                  {realtimeStatus === "connected" ? "⚡ REALTIME SSE ACTIVE" : "POLLING"} • EVENT: {currentEvent?.name?.toUpperCase() || selectedEventId.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Event Switcher Selector & Logout */}
          <div className="flex items-center gap-2.5 flex-wrap justify-between md:justify-end">
            {/* Event Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-cyber-bg-darker border border-cyber-magenta/30 px-2.5 py-1 text-xs font-mono">
              <Layers className="w-3.5 h-3.5 text-cyber-magenta shrink-0" />
              <label htmlFor="admin-event-select" className="sr-only">Scope Event</label>
              <select
                id="admin-event-select"
                aria-label="Scope Event"
                value={selectedEventId}
                onChange={(e) => handleEventSwitch(e.target.value)}
                disabled={actionLoading}
                className="bg-transparent text-gray-200 outline-none cursor-pointer pr-1 text-xs font-bold"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id} className="bg-gray-900 text-white">
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>

            <CyberButton
              variant="red"
              size="sm"
              onClick={handleAdminLogout}
              className="flex items-center gap-1.5 shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" /> EXIT SESSION
            </CyberButton>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 flex-grow flex flex-col gap-6 w-full">
        
        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-cyber-magenta/20 overflow-x-auto gap-1 pb-1 font-orbitron text-xs">
          {[
            { id: "overview", label: "OVERVIEW", icon: Grid },
            { id: "events", label: "EVENTS", icon: Layers },
            { id: "judges", label: `JUDGES (${judges.length})`, icon: Users },
            { id: "teams", label: `TEAMS (${teams.length})`, icon: Trophy },
            { id: "criteria", label: `CRITERIA (${criteria.length})`, icon: ListFilter },
            { id: "matrix", label: "MATRIX SPREADSHEET", icon: FileSpreadsheet },
            { id: "leaderboard", label: "LEADERBOARD", icon: Trophy },
            { id: "system", label: "SYSTEM & TIMER", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-3.5 py-2.5 tracking-wider uppercase transition-all duration-200 border-b-2 whitespace-nowrap
                  ${isActive 
                    ? "border-cyber-magenta bg-cyber-magenta/15 text-white font-bold" 
                    : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-cyber-magenta/5"
                  }
                `}
              >
                <Icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* ============================================================== */}
        {/* TAB 1: OVERVIEW                                                */}
        {/* ============================================================== */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="cyber-glass border border-cyber-magenta/20 p-5 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-gray-400 uppercase">ACTIVE EVENT</span>
              <span className="font-orbitron font-extrabold text-base text-cyber-magenta truncate">
                {currentEvent?.name || "DEFAULT EVENT"}
              </span>
              <span className="text-[9px] font-mono text-gray-500">ID: {selectedEventId}</span>
            </div>

            <div className="cyber-glass border border-cyber-magenta/20 p-5 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-gray-400 uppercase">TEAMS EVALUATED</span>
              <span className="font-orbitron font-extrabold text-2xl text-white">
                {teams.filter((t) => scores.some((s) => s.teamId === t.id)).length} / {teams.length}
              </span>
              <span className="text-[9px] font-mono text-cyber-green">ACTIVE IN THIS EVENT</span>
            </div>

            <div className="cyber-glass border border-cyber-magenta/20 p-5 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-gray-400 uppercase">PRESENTATION LIMIT</span>
              <span className="font-orbitron font-extrabold text-2xl text-cyber-cyan">
                {timerMinutes} MIN
              </span>
              <span className="text-[9px] font-mono text-gray-500">{timerMinutes * 60} SECONDS</span>
            </div>

            <div className="cyber-glass border border-cyber-magenta/20 p-5 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-gray-400 uppercase">BROADCAST SIGNAL</span>
              <span className={`font-orbitron font-extrabold text-xl ${announceResults ? "text-cyber-green" : "text-cyber-red"}`}>
                {announceResults ? "LIVE UNLOCKED" : "LOCKED"}
              </span>
              <span className="text-[9px] font-mono text-gray-500">/results FEED</span>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: EVENTS MANAGEMENT (REQUIREMENT 6 & 8)                   */}
        {/* ============================================================== */}
        {activeTab === "events" && (
          <div className="flex flex-col gap-6">
            {/* Create New Event Form */}
            <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-4">
              <h2 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase border-b border-cyber-magenta/15 pb-2">
                ➕ CREATE NEW HACKATHON / EVALUATION EVENT
              </h2>

              <form onSubmit={handleCreateEvent} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <CyberInput
                  variant="magenta"
                  label="EVENT NAME"
                  placeholder="e.g. IEEE Innovation Challenge"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  disabled={actionLoading}
                  required
                />
                <CyberInput
                  variant="magenta"
                  label="SUBTITLE / THEME"
                  placeholder="e.g. Student Branch Flagship 2026"
                  value={newEventSubtitle}
                  onChange={(e) => setNewEventSubtitle(e.target.value)}
                  disabled={actionLoading}
                />
                <CyberInput
                  variant="magenta"
                  label="ORGANIZER NAME"
                  placeholder="e.g. IEEE CIS / BMSIT"
                  value={newEventOrganizer}
                  onChange={(e) => setNewEventOrganizer(e.target.value)}
                  disabled={actionLoading}
                />
                <CyberInput
                  variant="magenta"
                  label="LOGO SVG/IMAGE PATH"
                  placeholder="e.g. /ieee-logo.svg or /pals-logo.svg"
                  value={newEventLogo}
                  onChange={(e) => setNewEventLogo(e.target.value)}
                  disabled={actionLoading}
                />
                <CyberInput
                  variant="magenta"
                  label="TIME LIMIT (MINUTES)"
                  type="number"
                  min="1"
                  max="60"
                  value={newEventTimer}
                  onChange={(e) => setNewEventTimer(e.target.value)}
                  disabled={actionLoading}
                />

                <div className="flex items-end">
                  <CyberButton type="submit" variant="magenta" fullWidth disabled={actionLoading}>
                    {actionLoading ? "CREATING..." : "CREATE & INITIALIZE EVENT"}
                  </CyberButton>
                </div>
              </form>
            </div>

            {/* List of Registered Events */}
            <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-4">
              <h2 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase border-b border-cyber-magenta/15 pb-2">
                🌐 REGISTERED PLATFORM EVENTS ({events.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events.map((ev) => {
                  const isCurrent = ev.id === selectedEventId;
                  return (
                    <div 
                      key={ev.id}
                      className={`p-4 border transition-all flex flex-col justify-between gap-3 ${
                        isCurrent 
                          ? "border-cyber-magenta bg-cyber-magenta/10 shadow-[0_0_15px_rgba(217,70,239,0.15)]" 
                          : "border-gray-800 bg-cyber-bg-darker/60 hover:border-gray-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {ev.logo && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={ev.logo} alt="" className="h-5 max-w-[80px] object-contain" />
                            )}
                            <h3 className="font-orbitron font-bold text-white text-sm uppercase truncate">
                              {ev.name}
                            </h3>
                          </div>
                          {ev.subtitle && <p className="text-xs text-gray-400 font-mono mt-0.5">{ev.subtitle}</p>}
                          {ev.organizer && <p className="text-[10px] text-cyber-cyan font-mono mt-0.5">By {ev.organizer}</p>}
                          <p className="text-[10px] text-gray-500 font-mono mt-1">ID: {ev.id} • Timer: {Math.round(ev.timerDuration / 60)}m</p>
                        </div>

                        {isCurrent && (
                          <span className="text-[9px] font-mono text-cyber-green bg-cyber-green/10 border border-cyber-green/30 px-2 py-0.5 font-bold uppercase shrink-0">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 border-t border-white/5 pt-2">
                        {!isCurrent && (
                          <CyberButton
                            variant="cyan"
                            size="sm"
                            onClick={() => handleEventSwitch(ev.id)}
                            disabled={actionLoading}
                          >
                            SWITCH TO THIS EVENT
                          </CyberButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: JUDGES (SCOPED TO CURRENT EVENT)                         */}
        {/* ============================================================== */}
        {activeTab === "judges" && (
          <div className="flex flex-col gap-6">
            {/* Add Judge Form */}
            <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-4">
              <h2 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase border-b border-cyber-magenta/15 pb-2">
                ➕ ASSIGN NEW JUDGE TO {currentEvent?.name?.toUpperCase() || "CURRENT EVENT"}
              </h2>

              <form onSubmit={handleAddJudge} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <CyberInput
                  variant="magenta"
                  label="FULL NAME"
                  placeholder="e.g. Dr. Jane Smith"
                  value={newJudgeName}
                  onChange={(e) => setNewJudgeName(e.target.value)}
                  disabled={actionLoading}
                  required
                />
                <CyberInput
                  variant="magenta"
                  label="DESIGNATION"
                  placeholder="e.g. Professor, AI Dept"
                  value={newJudgeDesg}
                  onChange={(e) => setNewJudgeDesg(e.target.value)}
                  disabled={actionLoading}
                  required
                />
                <CyberInput
                  variant="magenta"
                  label="USERNAME / EMAIL"
                  placeholder="e.g. janesmith@test.com"
                  value={newJudgeUser}
                  onChange={(e) => setNewJudgeUser(e.target.value)}
                  disabled={actionLoading}
                  required
                />
                <CyberInput
                  variant="magenta"
                  label="INITIAL PASSWORD"
                  type="password"
                  placeholder="••••••••"
                  value={newJudgePass}
                  onChange={(e) => setNewJudgePass(e.target.value)}
                  disabled={actionLoading}
                  required
                />
                <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                  <CyberButton type="submit" variant="magenta" disabled={actionLoading}>
                    REGISTER & ASSIGN TO THIS EVENT
                  </CyberButton>
                </div>
              </form>
            </div>

            {/* Judges Table */}
            <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-4">
              <h2 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase border-b border-cyber-magenta/15 pb-2">
                👥 ASSIGNED JUDGES ({judges.length})
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="p-2.5 uppercase">NAME</th>
                      <th className="p-2.5 uppercase">DESIGNATION</th>
                      <th className="p-2.5 uppercase">EMAIL / USERNAME</th>
                      <th className="p-2.5 uppercase">EVENT</th>
                      <th className="p-2.5 uppercase">STATUS</th>
                      <th className="p-2.5 uppercase text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {judges.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-500 italic">No judges registered for this event.</td>
                      </tr>
                    ) : (
                      judges.map((j) => (
                        <tr key={j.id} className="border-b border-gray-900 hover:bg-white/5">
                          <td className="p-2.5 font-bold text-white">{j.name}</td>
                          <td className="p-2.5 text-gray-300">{j.designation}</td>
                          <td className="p-2.5 text-cyber-cyan">{j.email || j.username}</td>
                          <td className="p-2.5 text-gray-400">{j.eventId || "default_event"}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase ${j.completed ? "bg-cyber-green/10 text-cyber-green border border-cyber-green/30" : "bg-cyber-yellow/10 text-cyber-yellow"}`}>
                              {j.completed ? "COMPLETED" : "EVALUATING"}
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveJudge(j.id)}
                              className="text-gray-500 hover:text-cyber-red p-1 cursor-pointer"
                              title="Delete Judge"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: TEAMS (SCOPED TO CURRENT EVENT)                          */}
        {/* ============================================================== */}
        {activeTab === "teams" && (
          <div className="flex flex-col gap-6">
            {/* Add Team Form */}
            <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-4">
              <h2 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase border-b border-cyber-magenta/15 pb-2">
                ➕ REGISTER TEAM FOR {currentEvent?.name?.toUpperCase() || "CURRENT EVENT"}
              </h2>

              <form onSubmit={handleAddTeam} className="flex flex-col sm:flex-row gap-4">
                <div className="flex-grow">
                  <CyberInput
                    variant="magenta"
                    label="TEAM NAME"
                    placeholder="e.g. NeuroSync AI"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    disabled={actionLoading}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <CyberButton type="submit" variant="magenta" disabled={actionLoading}>
                    ADD TEAM
                  </CyberButton>
                </div>
              </form>
            </div>

            {/* Teams Table */}
            <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-4">
              <h2 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase border-b border-cyber-magenta/15 pb-2">
                🏆 REGISTERED TEAMS ({teams.length})
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="p-2.5 uppercase">TEAM NAME</th>
                      <th className="p-2.5 uppercase">CODE</th>
                      <th className="p-2.5 uppercase">PROJECT</th>
                      <th className="p-2.5 uppercase">EVENT</th>
                      <th className="p-2.5 uppercase">EVALUATIONS</th>
                      <th className="p-2.5 uppercase text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-500 italic">No teams registered for this event.</td>
                      </tr>
                    ) : (
                      teams.map((t) => {
                        const isDq = t.name.startsWith("[DISQUALIFIED]");
                        const evCount = scores.filter((s) => s.teamId === t.id).length;

                        return (
                          <tr key={t.id} className="border-b border-gray-900 hover:bg-white/5">
                            <td className={`p-2.5 font-bold ${isDq ? "text-cyber-red line-through" : "text-white"}`}>
                              {t.name}
                            </td>
                            <td className="p-2.5 text-gray-400">{t.teamCode}</td>
                            <td className="p-2.5 text-gray-300">{t.projectName || t.name}</td>
                            <td className="p-2.5 text-gray-400">{t.eventId || "default_event"}</td>
                            <td className="p-2.5 text-cyber-cyan font-bold">{evCount} jurists</td>
                            <td className="p-2.5 text-right flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleDisqualifyTeam(t.id, t.name, isDq)}
                                className={`px-2 py-0.5 text-[10px] font-bold uppercase border cursor-pointer ${
                                  isDq ? "border-cyber-green text-cyber-green hover:bg-cyber-green/10" : "border-cyber-yellow text-cyber-yellow hover:bg-cyber-yellow/10"
                                }`}
                              >
                                {isDq ? "REINSTATE" : "DISQUALIFY"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveTeam(t.id)}
                                className="text-gray-500 hover:text-cyber-red p-1 cursor-pointer"
                                title="Delete Team"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: CRITERIA                                                */}
        {/* ============================================================== */}
        {activeTab === "criteria" && (
          <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-cyber-magenta/15 pb-3">
              <div>
                <h2 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase">
                  ⚙️ SCORING CRITERIA FOR {currentEvent?.name?.toUpperCase() || "CURRENT EVENT"}
                </h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">Parameters evaluated out of 10 integer marks.</p>
              </div>

              <CyberButton variant="magenta" size="sm" onClick={handleSaveCriteria} disabled={actionLoading}>
                <Save className="w-3.5 h-3.5" /> SAVE CRITERIA LIST
              </CyberButton>
            </div>

            <form onSubmit={handleAddCriteria} className="flex gap-3">
              <div className="flex-grow">
                <CyberInput
                  variant="magenta"
                  placeholder="e.g. Technical Feasibility"
                  value={newCriteriaName}
                  onChange={(e) => setNewCriteriaName(e.target.value)}
                  disabled={actionLoading}
                />
              </div>
              <CyberButton type="submit" variant="cyan" size="sm" disabled={actionLoading}>
                ADD PARAMETER
              </CyberButton>
            </form>

            <div className="flex flex-col gap-2 mt-2">
              {criteria.map((c, index) => (
                <div key={c.id} className="flex items-center gap-3 bg-cyber-bg-darker/60 border border-gray-800 p-2.5">
                  <span className="font-mono text-xs font-bold text-cyber-magenta w-8 shrink-0">#{index + 1}</span>
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => handleCriteriaChange(index, e.target.value)}
                    className="flex-grow bg-transparent text-white font-mono text-xs outline-none border-b border-gray-700 focus:border-cyber-magenta py-1"
                  />
                  {c.weight && <span className="text-[10px] text-gray-500 font-mono shrink-0">W: {c.weight}</span>}
                  <button
                    type="button"
                    onClick={() => handleRemoveCriteria(c.id)}
                    className="text-gray-500 hover:text-cyber-red p-1 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: MASTER MATRIX GRID                                      */}
        {/* ============================================================== */}
        {activeTab === "matrix" && (
          <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-cyber-magenta/15 pb-3">
              <div>
                <h2 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase">
                  🧮 JURY DATA MATRIX ({currentEvent?.name?.toUpperCase() || selectedEventId})
                </h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">Live scores matrix across all judges.</p>
              </div>

              {teams.length > 0 && (
                <CyberButton variant="cyan" size="sm" onClick={handleExportCSV} className="flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> EXPORT CSV
                </CyberButton>
              )}
            </div>

            {teams.length === 0 ? (
              <p className="text-xs font-mono italic text-gray-500 text-center py-6">No teams registered for this event.</p>
            ) : (
              <div className="overflow-x-auto border border-gray-800">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="bg-cyber-bg-darker border-b border-gray-800 text-gray-400">
                      <th className="p-3 font-orbitron uppercase">TEAM NAME</th>
                      {judges.map((j) => (
                        <th key={j.id} className="p-3 font-orbitron uppercase truncate max-w-[120px]" title={j.name}>
                          {j.name.split(" ")[0]}..
                        </th>
                      ))}
                      <th className="p-3 font-orbitron text-cyber-magenta text-right uppercase">AVG SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((t) => {
                      const teamScores = scores.filter((s) => s.teamId === t.id);
                      const avg = teamScores.length > 0
                        ? (teamScores.reduce((sum, s) => sum + s.totalScore, 0) / teamScores.length).toFixed(2)
                        : "0.00";

                      return (
                        <tr key={t.id} className="border-b border-gray-900 hover:bg-white/5">
                          <td className="p-3 font-bold text-white uppercase">{t.name}</td>
                          {judges.map((j) => {
                            const match = teamScores.find((s) => s.judgeId === j.id);
                            return (
                              <td key={j.id} className="p-3">
                                {match ? (
                                  <span className="text-cyber-cyan font-bold">{match.totalScore}</span>
                                ) : (
                                  <span className="text-[10px] text-cyber-yellow/60 font-semibold uppercase">PENDING</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-3 text-right font-orbitron font-extrabold text-sm text-cyber-magenta">
                            {avg}
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

        {/* ============================================================== */}
        {/* TAB 7: LEADERBOARD                                             */}
        {/* ============================================================== */}
        {activeTab === "leaderboard" && (
          <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-4">
            <h2 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase border-b border-cyber-magenta/15 pb-2">
              🏆 LEADERBOARD RANKINGS ({currentEvent?.name?.toUpperCase() || selectedEventId})
            </h2>

            <div className="flex flex-col gap-3">
              {leaderboard.length === 0 ? (
                <p className="text-xs font-mono italic text-gray-500 text-center py-6">No scores compiled yet for this event.</p>
              ) : (
                leaderboard.map((entry) => (
                  <div key={entry.teamId} className="bg-cyber-bg-darker/60 border border-gray-800 p-3.5 flex justify-between items-center hover:border-cyber-magenta/30">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 flex items-center justify-center font-orbitron font-extrabold text-sm border ${
                        entry.rank === 1 ? "border-cyber-yellow text-cyber-yellow bg-cyber-yellow/10" :
                        entry.rank === 2 ? "border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10" :
                        entry.rank === 3 ? "border-cyber-magenta text-cyber-magenta bg-cyber-magenta/10" :
                        "border-gray-800 text-gray-400"
                      }`}>
                        #{entry.rank}
                      </div>
                      <div>
                        <span className="font-orbitron font-bold text-xs text-white uppercase">{entry.teamName}</span>
                        <span className="text-[9px] text-gray-500 font-mono block">
                          Scored by {entry.judgeSubmissions.length} Jurists
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-gray-500 font-mono uppercase block">WEIGHTED AVG</span>
                      <span className="font-orbitron font-extrabold text-base text-cyber-magenta">
                        {entry.averageScore} PTS
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 8: SYSTEM SETTINGS & PRESENTATION TIMER (REQUIREMENT 3)    */}
        {/* ============================================================== */}
        {activeTab === "system" && (
          <div className="flex flex-col gap-6">
            {/* PRESENTATION TIMER CARD (REQUIREMENT 3 FIX) */}
            <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-cyber-magenta/15 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyber-magenta" />
                  <div>
                    <h2 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase">
                      ⏲️ PRESENTATION TIME LIMIT CONFIGURATION
                    </h2>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      Sets presentation clock for all judges evaluating {currentEvent?.name || "this event"}.
                    </p>
                  </div>
                </div>

                <CyberButton
                  variant="magenta"
                  size="md"
                  onClick={handleSaveTimer}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 shrink-0"
                >
                  <Save className="w-4 h-4" /> SAVE TIME LIMIT
                </CyberButton>
              </div>

              {/* Status Indicator */}
              <div className="bg-cyber-magenta/5 border border-cyber-magenta/20 p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-xs">
                <span className="text-gray-300">
                  CURRENT CONFIGURED DURATION: <strong className="text-cyber-magenta font-bold">{timerMinutes} MINUTES ({timerMinutes * 60} SECONDS)</strong>
                </span>
                <span className="text-[10px] text-gray-500">
                  EVENT: {selectedEventId}
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-col gap-1.5">
                <label className="font-orbitron text-xs font-semibold text-gray-300 uppercase">
                  QUICK PRESETS (MINUTES):
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[2, 3, 5, 7, 8, 10, 15].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleTimerPreset(preset)}
                      className={`px-3 py-1.5 font-mono text-xs border transition-all cursor-pointer ${
                        parseInt(timerInputStr, 10) === preset
                          ? "border-cyber-magenta bg-cyber-magenta/20 text-white font-bold shadow-[0_0_8px_rgba(217,70,239,0.3)]"
                          : "border-gray-800 bg-cyber-bg-darker hover:border-gray-600 text-gray-400"
                      }`}
                    >
                      {preset} MIN
                    </button>
                  ))}
                </div>
              </div>

              {/* Minute Input Field */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end bg-cyber-bg-darker/60 p-4 border border-cyber-magenta/10">
                <div className="flex-grow w-full sm:w-auto">
                  <label htmlFor="timer-limit-input" className="font-orbitron text-xs font-semibold text-cyber-magenta tracking-widest uppercase block mb-1">
                    TIME LIMIT (1–60 WHOLE MINUTES)
                  </label>
                  <input
                    id="timer-limit-input"
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    value={timerInputStr}
                    onChange={(e) => handleTimerInputChange(e.target.value)}
                    disabled={actionLoading}
                    className="w-full bg-cyber-bg-darker/90 text-white font-mono text-base px-4 py-2 border border-cyber-magenta/40 focus:border-cyber-magenta outline-none"
                  />
                </div>

                <CyberButton
                  variant="magenta"
                  size="md"
                  onClick={handleSaveTimer}
                  disabled={actionLoading}
                  className="w-full sm:w-auto shrink-0"
                >
                  SET TO {parseInt(timerInputStr, 10) || 5} MIN
                </CyberButton>
              </div>
            </div>

            {/* Broadcast Switcher card */}
            <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-cyber-magenta/15 pb-2.5">
                <Radio className="w-5 h-5 text-cyber-magenta" />
                <h2 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase">
                  PUBLIC RESULTS BROADCASTER ({currentEvent?.name || selectedEventId})
                </h2>
              </div>
              <p className="text-xs text-gray-400 font-sans leading-relaxed">
                Broadcasting unlocks `/results?event={selectedEventId}` for the public, revealing podium scores. Locking re-encrypts the results feed.
              </p>

              <div className="flex items-center justify-between bg-cyber-bg-darker/60 border border-gray-800 p-4">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full ${announceResults ? "bg-cyber-green animate-ping" : "bg-cyber-red"}`} />
                  <span className="text-white uppercase font-bold">
                    SIGNAL: {announceResults ? "BROADCAST ACTIVE" : "ENCRYPTED / LOCKED"}
                  </span>
                </div>
                <CyberButton
                  variant={announceResults ? "red" : "green"}
                  size="sm"
                  onClick={handleToggleBroadcast}
                  disabled={actionLoading}
                >
                  {announceResults ? "DISCONNECT FEED" : "BROADCAST RESULTS"}
                </CyberButton>
              </div>
            </div>

            {/* Reset scores for event */}
            <div className="cyber-glass border border-cyber-red/25 p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-cyber-red/20 pb-2">
                <AlertOctagon className="w-5 h-5 text-cyber-red" />
                <h2 className="font-orbitron text-sm font-bold text-cyber-red tracking-wide uppercase">
                  RESET SCORES FOR CURRENT EVENT
                </h2>
              </div>
              <p className="text-xs text-gray-400 font-sans leading-relaxed">
                Erases all evaluation scores submitted for {currentEvent?.name || "this event"} only. Leaves other events untouched.
              </p>

              <div className="flex justify-end mt-2">
                <CyberButton
                  variant="red"
                  size="sm"
                  onClick={handleFactoryReset}
                  disabled={actionLoading}
                >
                  🚨 ERASE SCORES FOR THIS EVENT
                </CyberButton>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
