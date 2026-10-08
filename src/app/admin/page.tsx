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
  AlertOctagon, 
  KeyRound,
  FileSpreadsheet,
  Layers,
  PlusCircle,
  Edit3,
  Calendar,
  X
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
  resetDatabase,
  initDatabase,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  publishResults,
  declareResults,
  revokeResultsDeclaration
} from "@/lib/db";
import { Judge, Team, ScoringCriteria, ScoreRecord, LeaderboardEntry, EventItem } from "@/lib/types";
import { useRealtimeSync } from "@/lib/useRealtimeSync";
import CyberButton from "@/components/CyberButton";
import CyberInput from "@/components/CyberInput";
import ImageUpload from "@/components/ImageUpload";

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
  
  // UI Tabs: 'overview' | 'events' | 'judges' | 'teams' | 'criteria' | 'matrix' | 'leaderboard' | 'system'
  const [activeTab, setActiveTab] = useState("overview");

  // Dynamic Add Forms state
  const [newJudgeName, setNewJudgeName] = useState("");
  const [newJudgeDesg, setNewJudgeDesg] = useState("");
  const [newJudgeUser, setNewJudgeUser] = useState("");
  const [newJudgePass, setNewJudgePass] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newCriteriaName, setNewCriteriaName] = useState("");

  // Event Creation state
  const [newEventName, setNewEventName] = useState("");
  const [newEventSubtitle, setNewEventSubtitle] = useState("");
  const [newEventOrganizer, setNewEventOrganizer] = useState("");
  const [newEventLogo, setNewEventLogo] = useState("");
  const [newEventOrgLogo, setNewEventOrgLogo] = useState("");
  const [newEventBanner, setNewEventBanner] = useState("");
  const [newEventDate, setNewEventDate] = useState("");

  // Selected Event Editing state
  const [editEventName, setEditEventName] = useState("");
  const [editEventSubtitle, setEditEventSubtitle] = useState("");
  const [editEventOrganizer, setEditEventOrganizer] = useState("");
  const [editEventLogo, setEditEventLogo] = useState("");
  const [editEventOrgLogo, setEditEventOrgLogo] = useState("");
  const [editEventBanner, setEditEventBanner] = useState("");
  const [editEventDate, setEditEventDate] = useState("");
  const [editEventStatus, setEditEventStatus] = useState("active");

  // Event Modals state
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);

  // Event Deletion state
  const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeleteEventModalOpen, setIsDeleteEventModalOpen] = useState(false);

  // Result Declaration / Publish state
  const [isDeclareResultsModalOpen, setIsDeclareResultsModalOpen] = useState(false);
  const [declareOverride, setDeclareOverride] = useState(false);

  // Loading indicator states
  const [dbLoading, setDbLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const isInitialLoadRef = useRef(true);
  const selectedEventIdRef = useRef("default_event");

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  // Synchronize edit fields when currentEvent changes
  useEffect(() => {
    if (currentEvent) {
      setEditEventName(currentEvent.name || "");
      setEditEventSubtitle(currentEvent.subtitle || "");
      setEditEventOrganizer(currentEvent.organizer || "");
      setEditEventLogo(currentEvent.logo || "");
      setEditEventOrgLogo(currentEvent.organizerLogo || "");
      setEditEventBanner(currentEvent.banner || "");
      setEditEventDate(currentEvent.date || "");
      setEditEventStatus(currentEvent.status || "active");
    }
  }, [currentEvent]);

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

  const fetchDbData = async (requestedEventId: string = selectedEventIdRef.current, isBackground = false) => {
    if (!isBackground && isInitialLoadRef.current) {
      setDbLoading(true);
    }
    try {
      const eventsList = await getEvents();
      setEvents(eventsList || []);

      let effectiveEventId = requestedEventId;
      if (eventsList && eventsList.length > 0) {
        const found = eventsList.find((e) => e.id === requestedEventId);
        if (found) {
          effectiveEventId = found.id;
        } else {
          effectiveEventId = eventsList[0].id;
        }
      }

      if (effectiveEventId !== selectedEventIdRef.current) {
        setSelectedEventId(effectiveEventId);
        selectedEventIdRef.current = effectiveEventId;
      }

      const [jList, tList, sList, config, lList] = await Promise.all([
        getJudges(effectiveEventId),
        getTeams(effectiveEventId),
        getScores(effectiveEventId),
        getConfig(effectiveEventId),
        getLeaderboard(effectiveEventId),
      ]);

      const matchedEv = (eventsList || []).find((e) => e.id === effectiveEventId) || config?.event || null;
      setCurrentEvent(matchedEv);

      setJudges(jList || []);
      setTeams(tList || []);
      setScores(sList || []);
      setCriteria(config?.criteriaList || []);
      setAnnounceResults(Boolean(config?.announceResults));
      setLeaderboard(lList || []);

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
    fetchDbData(newId, false);
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
    if (actionLoading) return;
    if (!newEventName.trim()) return;
    setActionLoading(true);
    try {
      const res = await createEvent({
        name: newEventName.trim(),
        subtitle: newEventSubtitle.trim(),
        organizer: newEventOrganizer.trim(),
        logo: newEventLogo.trim(),
        organizerLogo: newEventOrgLogo.trim(),
        banner: newEventBanner.trim(),
        date: newEventDate.trim(),
        status: "active",
      });

      if (!res.success || !res.data) {
        alert(`FAIL: EVENT CREATION FAILED.\n\n${res.error}`);
        return;
      }

      setNewEventName("");
      setNewEventSubtitle("");
      setNewEventOrganizer("");
      setNewEventLogo("");
      setNewEventOrgLogo("");
      setNewEventBanner("");
      setNewEventDate("");
      setIsCreateEventModalOpen(false);
      alert(`✅ EVENT "${res.data.name}" CREATED SUCCESSFULLY.`);
      handleEventSwitch(res.data.id);
    } catch (err: any) {
      alert(`FAIL: EVENT CREATION ERROR: ${err?.message || "Database error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateCurrentEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionLoading) return;
    if (!editEventName.trim()) return;
    setActionLoading(true);
    try {
      const res = await updateEvent(selectedEventId, {
        name: editEventName.trim(),
        subtitle: editEventSubtitle.trim(),
        organizer: editEventOrganizer.trim(),
        logo: editEventLogo.trim(),
        organizerLogo: editEventOrgLogo.trim(),
        banner: editEventBanner.trim(),
        date: editEventDate.trim(),
        status: editEventStatus.trim() || "active",
      });

      if (!res.success || !res.data) {
        alert(`FAIL: EVENT UPDATE FAILED.\n\n${res.error}`);
        return;
      }

      setIsEditEventModalOpen(false);
      alert(`✅ EVENT "${res.data.name}" SETTINGS SAVED SUCCESSFULLY.`);
      await fetchDbData(selectedEventId, false);
    } catch (err: any) {
      alert(`FAIL: EVENT UPDATE ERROR: ${err?.message || "Database error"}`);
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

  const handleRemoveCriteria = async (id: string) => {
    if (criteria.length <= 1) {
      alert("FAIL: AT LEAST ONE SCORING CRITERION MUST PERSIST.");
      return;
    }
    const updated = criteria.filter((c) => c.id !== id);
    setCriteria(updated);
    setActionLoading(true);
    try {
      const res = await updateCriteria(updated, selectedEventId);
      if (res.success) {
        await fetchDbData(selectedEventId, false);
      } else {
        alert(`FAIL: CONFIG TRANSMISSION FAILURE.\n\n${res.error}`);
      }
    } catch (err: any) {
      alert(`FAIL: CONFIG TRANSMISSION FAILURE. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddCriteria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCriteriaName.trim() || actionLoading) return;
    const cleanName = newCriteriaName.trim();
    const newCriteria: ScoringCriteria = {
      id: `c_${selectedEventId}_${Date.now()}`,
      name: cleanName,
      maxScore: 10,
      weight: 1.0,
      orderIndex: criteria.length,
      active: true,
      eventId: selectedEventId,
    };
    const updated = [...criteria, newCriteria];
    setCriteria(updated);
    setNewCriteriaName("");
    setActionLoading(true);
    try {
      const res = await updateCriteria(updated, selectedEventId);
      if (res.success) {
        await fetchDbData(selectedEventId, false);
      } else {
        alert(`FAIL: CONFIG TRANSMISSION FAILURE.\n\n${res.error}`);
      }
    } catch (err: any) {
      alert(`FAIL: CONFIG TRANSMISSION FAILURE. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveCriteria = async () => {
    setActionLoading(true);
    try {
      const res = await updateCriteria(criteria, selectedEventId);
      if (!res.success) {
        alert(`FAIL: CONFIG TRANSMISSION FAILURE.\n\n${res.error}`);
        return;
      }
      await fetchDbData(selectedEventId, false);
      alert("SYSTEM STATUS: SCORING PARAMETERS UPDATED FOR CURRENT EVENT.");
    } catch (err: any) {
      alert(`FAIL: CONFIG TRANSMISSION FAILURE. (${err?.message || "Database error"})`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDeleteEvent = async () => {
    if (!eventToDelete || actionLoading) return;
    if (deleteConfirmInput.trim() !== eventToDelete.name.trim()) return;

    setActionLoading(true);
    try {
      const deletedId = eventToDelete.id;
      const deletedName = eventToDelete.name;
      const res = await deleteEvent(deletedId);
      if (!res.success) {
        alert(`FAIL: EVENT DELETION REJECTED.\n\n${res.error}`);
        return;
      }

      setIsDeleteEventModalOpen(false);
      setEventToDelete(null);
      setDeleteConfirmInput("");

      // Update local events list
      const updatedEvents = events.filter((e) => e.id !== deletedId);
      setEvents(updatedEvents);

      if (deletedId === selectedEventId) {
        if (updatedEvents.length > 0) {
          const nextEventId = updatedEvents[0].id;
          setSelectedEventId(nextEventId);
          selectedEventIdRef.current = nextEventId;
          await fetchDbData(nextEventId, false);
        } else {
          setSelectedEventId("");
          selectedEventIdRef.current = "";
          setCurrentEvent(null);
          setJudges([]);
          setTeams([]);
          setScores([]);
          setCriteria([]);
          setLeaderboard([]);
        }
      } else {
        await fetchDbData(selectedEventId, true);
      }

      alert(`✅ EVENT "${deletedName}" PERMANENTLY DELETED.`);
    } catch (err: any) {
      alert(`FAIL: ERROR DELETING EVENT: ${err?.message || "Database error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPublishResults = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await publishResults(selectedEventId);
      if (!res.success) {
        alert(`FAIL: RESULT PUBLICATION FAILED.\n\n${res.error}`);
        return;
      }
      setIsDeclareResultsModalOpen(false);
      setDeclareOverride(false);
      alert(`🏆 FINAL RESULTS OFFICIALLY PUBLISHED FOR "${currentEvent?.name || selectedEventId}".`);
      await fetchDbData(selectedEventId, false);
    } catch (err: any) {
      alert(`FAIL: PUBLICATION ERROR: ${err?.message || "Database error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeResults = async () => {
    if (actionLoading) return;
    const confirmRevoke = window.confirm(
      `⚠️ RE-OPEN EVALUATION?\n\nAre you sure you want to revoke results publication for "${currentEvent?.name || selectedEventId}"? The event will transition back to ACTIVE evaluation state.`
    );
    if (!confirmRevoke) return;

    setActionLoading(true);
    try {
      const res = await revokeResultsDeclaration(selectedEventId);
      if (!res.success) {
        alert(`FAIL: REVOKING PUBLICATION FAILED.\n\n${res.error}`);
        return;
      }
      alert(`✅ EVALUATION RE-OPENED FOR "${currentEvent?.name || selectedEventId}".`);
      await fetchDbData(selectedEventId, false);
    } catch (err: any) {
      alert(`FAIL: ERROR REVOKING PUBLICATION: ${err?.message || "Database error"}`);
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
            {/* Event Logo & Organizer Logo (or clean generic badge fallback) */}
            <div className="flex items-center gap-2 shrink-0">
              {currentEvent?.logo && (
                <div className="p-1 bg-black/40 border border-cyber-magenta/30 flex items-center justify-center shrink-0">
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
                <div className="p-1 bg-black/40 border border-gray-700 flex items-center justify-center shrink-0">
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
                <span className="p-2 bg-cyber-magenta/10 text-cyber-magenta border border-cyber-magenta/30 shrink-0">
                  <Settings className="w-5 h-5 animate-spin" />
                </span>
              )}
            </div>

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
            { id: "system", label: "BROADCAST SYSTEM", icon: Settings },
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
              <span className="text-[10px] font-mono text-gray-400 uppercase">JURISTS ASSIGNED</span>
              <span className="font-orbitron font-extrabold text-2xl text-cyber-cyan">
                {judges.length}
              </span>
              <span className="text-[9px] font-mono text-gray-500">ACTIVE IN THIS EVENT</span>
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
        {/* ============================================================== */}
        {/* TAB 2: EVENTS & BRANDING CONFIGURATION                         */}
        {/* ============================================================== */}
        {activeTab === "events" && (
          <div className="flex flex-col gap-6">
            {/* Header & Current Event Card */}
            <div className="cyber-glass border border-cyber-magenta/30 p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-cyber-magenta/20 pb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyber-magenta" />
                  <h2 className="font-orbitron text-base font-bold text-cyber-magenta tracking-wide uppercase">
                    EVENT MANAGEMENT
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <CyberButton
                    type="button"
                    variant="magenta"
                    size="sm"
                    onClick={() => {
                      if (currentEvent) {
                        setEditEventName(currentEvent.name || "");
                        setEditEventSubtitle(currentEvent.subtitle || "");
                        setEditEventOrganizer(currentEvent.organizer || "");
                        setEditEventLogo(currentEvent.logo || "");
                        setEditEventOrgLogo(currentEvent.organizerLogo || "");
                        setEditEventBanner(currentEvent.banner || "");
                        setEditEventDate(currentEvent.date || "");
                        setEditEventStatus(currentEvent.status || "active");
                      }
                      setIsEditEventModalOpen(true);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <Edit3 className="w-4 h-4" /> EDIT EVENT
                  </CyberButton>
                  <CyberButton
                    type="button"
                    variant="cyan"
                    size="sm"
                    onClick={() => setIsCreateEventModalOpen(true)}
                    className="flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" /> + CREATE NEW EVENT
                  </CyberButton>
                </div>
              </div>

              {/* Current Active Event Banner */}
              <div className="relative overflow-hidden bg-cyber-bg-darker/80 border border-cyber-magenta/40 p-5 rounded-none flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_25px_rgba(217,70,239,0.1)]">
                {currentEvent?.banner && (
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-30 filter blur-[0.5px] pointer-events-none"
                    style={{ backgroundImage: `url(${currentEvent.banner})` }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-cyber-bg-darker via-cyber-bg-darker/90 to-transparent pointer-events-none" />

                <div className="relative z-10 flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 border border-cyber-magenta/50 bg-black/60 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                    {currentEvent?.logo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={currentEvent.logo} alt="" className="max-w-full max-h-full object-contain p-1" />
                    ) : (
                      <Layers className="w-7 h-7 text-cyber-magenta" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-cyber-magenta/20 border border-cyber-magenta/40 text-cyber-magenta font-bold">
                        CURRENT ACTIVE EVENT
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        ID: {selectedEventId}
                      </span>
                      {currentEvent?.banner && (
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-cyber-cyan/20 border border-cyber-cyan/40 text-cyber-cyan font-bold">
                          🖼️ BANNER ATTACHED
                        </span>
                      )}
                    </div>
                    <h3 className="font-orbitron text-lg sm:text-xl font-bold text-white uppercase tracking-wider mt-1 truncate">
                      {currentEvent?.name || selectedEventId}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-400 font-mono mt-0.5 flex-wrap">
                      {currentEvent?.organizer && (
                        <span className="text-cyber-cyan font-bold">Organized by {currentEvent.organizer}</span>
                      )}
                      {currentEvent?.subtitle && (
                        <span>• {currentEvent.subtitle}</span>
                      )}
                      {currentEvent?.date && (
                        <span>• 📅 {currentEvent.date}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="relative z-10 flex items-center gap-2 self-end sm:self-center shrink-0">
                  <span className="text-xs font-mono px-2.5 py-1 bg-cyber-green/15 text-cyber-green border border-cyber-green/30 font-bold uppercase tracking-widest">
                    ACTIVE
                  </span>
                </div>
              </div>
            </div>

            {/* List of Registered Events */}
            <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-cyber-magenta/15 pb-2 flex-wrap gap-2">
                <h3 className="font-orbitron text-sm font-bold text-gray-200 tracking-wide uppercase">
                  REGISTERED EVENTS ({events.length})
                </h3>
                <span className="text-xs font-mono text-gray-400">
                  Switch or manage registered platform events
                </span>
              </div>

              {events.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-4 bg-cyber-bg-darker/60 border border-dashed border-gray-800">
                  <Layers className="w-10 h-10 text-gray-600" />
                  <div className="flex flex-col gap-1">
                    <p className="font-orbitron font-bold text-gray-300 uppercase tracking-wider text-sm">
                      No events created yet.
                    </p>
                    <p className="font-mono text-xs text-gray-500">
                      Initialize your first event to start assigning judges, teams, and criteria.
                    </p>
                  </div>
                  <CyberButton
                    variant="cyan"
                    size="sm"
                    onClick={() => setIsCreateEventModalOpen(true)}
                    className="flex items-center gap-1.5 mt-2"
                  >
                    <PlusCircle className="w-4 h-4" /> CREATE EVENT
                  </CyberButton>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        {ev.banner && (
                          <div className="relative w-full h-14 overflow-hidden border border-cyber-cyan/30 mb-1 rounded-none">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ev.banner} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                            <span className="absolute bottom-1 right-1 text-[8px] font-mono bg-black/80 px-1 text-cyber-cyan border border-cyber-cyan/30 font-bold uppercase">
                              BANNER
                            </span>
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {ev.logo ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={ev.logo} alt="" className="h-5 max-w-[80px] object-contain" />
                              ) : null}
                              {ev.organizerLogo ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={ev.organizerLogo} alt="" className="h-5 max-w-[80px] object-contain" />
                              ) : null}
                            </div>
                            <h4 className="font-orbitron font-bold text-white text-sm uppercase truncate">
                              {ev.name}
                            </h4>
                            {ev.organizer && <p className="text-xs text-cyber-cyan font-mono mt-0.5">{ev.organizer}</p>}
                            {ev.subtitle && <p className="text-[11px] text-gray-400 font-mono mt-0.5 line-clamp-1">{ev.subtitle}</p>}
                            <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500 font-mono flex-wrap">
                              <span>ID: {ev.id}</span>
                              {ev.date && (
                                <>
                                  <span>•</span>
                                  <span className="text-gray-400">{ev.date}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {isCurrent && (
                            <span className="text-[9px] font-mono text-cyber-green bg-cyber-green/10 border border-cyber-green/30 px-2 py-0.5 font-bold uppercase shrink-0">
                              ACTIVE
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/5 pt-2">
                          {!isCurrent && (
                            <CyberButton
                              variant="cyan"
                              size="sm"
                              onClick={() => handleEventSwitch(ev.id)}
                              disabled={actionLoading}
                            >
                              SWITCH
                            </CyberButton>
                          )}
                          <CyberButton
                            variant="magenta"
                            size="sm"
                            onClick={() => {
                              setEditEventName(ev.name || "");
                              setEditEventSubtitle(ev.subtitle || "");
                              setEditEventOrganizer(ev.organizer || "");
                              setEditEventLogo(ev.logo || "");
                              setEditEventOrgLogo(ev.organizerLogo || "");
                              setEditEventBanner(ev.banner || "");
                              setEditEventDate(ev.date || "");
                              setEditEventStatus(ev.status || "active");
                              setIsEditEventModalOpen(true);
                            }}
                            disabled={actionLoading}
                          >
                            <Edit3 className="w-3.5 h-3.5" /> EDIT
                          </CyberButton>
                          <CyberButton
                            variant="red"
                            size="sm"
                            onClick={() => {
                              setEventToDelete(ev);
                              setDeleteConfirmInput("");
                              setIsDeleteEventModalOpen(true);
                            }}
                            disabled={actionLoading}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> DELETE
                          </CyberButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* EDIT EVENT MODAL DIALOG */}
            {isEditEventModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
                <div className="relative w-full max-w-2xl bg-cyber-bg-dark border border-cyber-magenta p-6 shadow-[0_0_30px_rgba(217,70,239,0.3)] my-8">
                  <div className="flex items-center justify-between border-b border-cyber-magenta/30 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-5 h-5 text-cyber-magenta" />
                      <h3 className="font-orbitron text-base font-bold text-white uppercase tracking-wider">
                        EDIT EVENT SETTINGS
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditEventModalOpen(false)}
                      className="text-gray-400 hover:text-white transition-colors"
                      aria-label="Close modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleUpdateCurrentEvent} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <CyberInput
                        variant="magenta"
                        label="EVENT NAME"
                        placeholder="e.g. TechNova Hackathon"
                        value={editEventName}
                        onChange={(e) => setEditEventName(e.target.value)}
                        disabled={actionLoading}
                        required
                      />
                      <CyberInput
                        variant="magenta"
                        label="ORGANIZER / CLUB NAME"
                        placeholder="e.g. Computer Science Club"
                        value={editEventOrganizer}
                        onChange={(e) => setEditEventOrganizer(e.target.value)}
                        disabled={actionLoading}
                      />
                      <CyberInput
                        variant="magenta"
                        label="SUBTITLE / DESCRIPTION"
                        placeholder="e.g. Annual Collegiate Innovation Challenge"
                        value={editEventSubtitle}
                        onChange={(e) => setEditEventSubtitle(e.target.value)}
                        disabled={actionLoading}
                      />
                      <CyberInput
                        variant="magenta"
                        label="EVENT DATE / SCHEDULE"
                        placeholder="e.g. 2026-10-15 or Oct 15-16, 2026"
                        value={editEventDate}
                        onChange={(e) => setEditEventDate(e.target.value)}
                        disabled={actionLoading}
                      />
                      <div className="sm:col-span-1">
                        <ImageUpload
                          label="EVENT LOGO"
                          value={editEventLogo}
                          onChange={setEditEventLogo}
                          aspect="logo"
                          themeColor="magenta"
                          helperText="Official competition / hackathon logo"
                          disabled={actionLoading}
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <ImageUpload
                          label="ORGANIZER LOGO"
                          value={editEventOrgLogo}
                          onChange={setEditEventOrgLogo}
                          aspect="logo"
                          themeColor="magenta"
                          helperText="Club, department, or society logo"
                          disabled={actionLoading}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <ImageUpload
                          label="EVENT BANNER / COVER IMAGE"
                          value={editEventBanner}
                          onChange={setEditEventBanner}
                          aspect="banner"
                          themeColor="magenta"
                          helperText="Wide hero backdrop displayed across Results & Admin dashboards"
                          disabled={actionLoading}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-mono tracking-wider text-gray-400 uppercase mb-1">
                          EVENT STATUS
                        </label>
                        <select
                          value={editEventStatus}
                          onChange={(e) => setEditEventStatus(e.target.value)}
                          disabled={actionLoading}
                          className="w-full bg-cyber-bg-darker border border-cyber-magenta/40 px-3 py-2 text-sm text-white font-mono outline-none focus:border-cyber-magenta"
                        >
                          <option value="active">ACTIVE</option>
                          <option value="completed">COMPLETED</option>
                          <option value="upcoming">UPCOMING</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-cyber-magenta/20 pt-4 mt-2">
                      <CyberButton
                        type="button"
                        variant="cyan"
                        size="md"
                        onClick={() => setIsEditEventModalOpen(false)}
                        disabled={actionLoading}
                      >
                        CANCEL
                      </CyberButton>
                      <CyberButton
                        type="submit"
                        variant="magenta"
                        size="md"
                        disabled={actionLoading}
                        className="flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" /> {actionLoading ? "SAVING..." : "SAVE CHANGES"}
                      </CyberButton>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* CREATE EVENT MODAL DIALOG */}
            {isCreateEventModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
                <div className="relative w-full max-w-2xl bg-cyber-bg-dark border border-cyber-cyan p-6 shadow-[0_0_30px_rgba(6,182,212,0.3)] my-8">
                  <div className="flex items-center justify-between border-b border-cyber-cyan/30 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <PlusCircle className="w-5 h-5 text-cyber-cyan" />
                      <h3 className="font-orbitron text-base font-bold text-white uppercase tracking-wider">
                        CREATE NEW EVENT
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreateEventModalOpen(false)}
                      className="text-gray-400 hover:text-white transition-colors"
                      aria-label="Close modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateEvent} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <CyberInput
                        variant="cyan"
                        label="EVENT NAME"
                        placeholder="e.g. InnovateX 2026"
                        value={newEventName}
                        onChange={(e) => setNewEventName(e.target.value)}
                        disabled={actionLoading}
                        required
                      />
                      <CyberInput
                        variant="cyan"
                        label="ORGANIZER / CLUB NAME"
                        placeholder="e.g. Engineering Society"
                        value={newEventOrganizer}
                        onChange={(e) => setNewEventOrganizer(e.target.value)}
                        disabled={actionLoading}
                      />
                      <CyberInput
                        variant="cyan"
                        label="SUBTITLE / DESCRIPTION"
                        placeholder="e.g. Hardware & AI Exhibition"
                        value={newEventSubtitle}
                        onChange={(e) => setNewEventSubtitle(e.target.value)}
                        disabled={actionLoading}
                      />
                      <CyberInput
                        variant="cyan"
                        label="EVENT DATE"
                        placeholder="e.g. 2026-11-20"
                        value={newEventDate}
                        onChange={(e) => setNewEventDate(e.target.value)}
                        disabled={actionLoading}
                      />
                      <div className="sm:col-span-1">
                        <ImageUpload
                          label="EVENT LOGO"
                          value={newEventLogo}
                          onChange={setNewEventLogo}
                          aspect="logo"
                          themeColor="cyan"
                          helperText="Official competition / hackathon logo"
                          disabled={actionLoading}
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <ImageUpload
                          label="ORGANIZER LOGO"
                          value={newEventOrgLogo}
                          onChange={setNewEventOrgLogo}
                          aspect="logo"
                          themeColor="cyan"
                          helperText="Club, department, or society logo"
                          disabled={actionLoading}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <ImageUpload
                          label="EVENT BANNER / COVER IMAGE"
                          value={newEventBanner}
                          onChange={setNewEventBanner}
                          aspect="banner"
                          themeColor="cyan"
                          helperText="Wide hero backdrop displayed across Results & Admin dashboards"
                          disabled={actionLoading}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-cyber-cyan/20 pt-4 mt-2">
                      <CyberButton
                        type="button"
                        variant="magenta"
                        size="md"
                        onClick={() => setIsCreateEventModalOpen(false)}
                        disabled={actionLoading}
                      >
                        CANCEL
                      </CyberButton>
                      <CyberButton
                        type="submit"
                        variant="cyan"
                        size="md"
                        disabled={actionLoading}
                        className="flex items-center gap-2"
                      >
                        <PlusCircle className="w-4 h-4" /> {actionLoading ? "CREATING..." : "CREATE EVENT"}
                      </CyberButton>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* DELETE EVENT CONFIRMATION DIALOG MODAL (Requirement 1, 2, 24) */}
            {isDeleteEventModalOpen && eventToDelete && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
                <div className="w-full max-w-lg bg-cyber-bg-dark border border-cyber-red p-6 shadow-[0_0_35px_rgba(239,68,68,0.25)] flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-cyber-red/30 pb-3">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-cyber-red" />
                      <h3 className="font-orbitron text-base font-bold text-white uppercase tracking-wider">
                        DELETE EVENT?
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeleteEventModalOpen(false);
                        setEventToDelete(null);
                        setDeleteConfirmInput("");
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 font-mono text-xs text-gray-300">
                    <div className="p-3 bg-cyber-bg-darker border border-cyber-red/30 flex flex-col gap-1">
                      <div className="text-white font-orbitron font-bold text-sm uppercase">{eventToDelete.name}</div>
                      {eventToDelete.organizer && (
                        <div className="text-cyber-cyan text-[11px]">Organized by {eventToDelete.organizer}</div>
                      )}
                      <div className="text-gray-500 text-[10px]">ID: {eventToDelete.id}</div>
                    </div>

                    {Boolean(eventToDelete.resultsPublished || eventToDelete.resultsDeclared) && (
                      <div className="p-3 bg-cyber-red/15 border border-cyber-red text-cyber-red font-bold flex flex-col gap-1">
                        <span className="flex items-center gap-1.5 uppercase font-orbitron text-xs">
                          ⚠️ THIS EVENT HAS PUBLISHED RESULTS.
                        </span>
                        <span className="text-[11px] font-mono font-normal text-gray-300">
                          Deleting will permanently destroy public championship records, podium entries, and finalized rankings.
                        </span>
                      </div>
                    )}

                    <p className="text-gray-300 font-semibold">This will permanently remove:</p>
                    <ul className="list-disc pl-5 space-y-1 text-gray-300">
                      <li>Event</li>
                      <li>Assigned judges</li>
                      <li>Teams</li>
                      <li>Criteria</li>
                      <li>Scores</li>
                      <li>Event settings</li>
                      <li>Event results</li>
                      <li>Event-specific audit data where applicable</li>
                    </ul>

                    <p className="text-cyber-red font-bold mt-1">This action cannot be undone.</p>

                    <div className="flex flex-col gap-1.5 mt-2">
                      <label className="text-gray-300 text-[11px] uppercase tracking-wider">
                        Type the event name to confirm: <span className="text-white font-bold select-all">"{eventToDelete.name}"</span>
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmInput}
                        onChange={(e) => setDeleteConfirmInput(e.target.value)}
                        placeholder={eventToDelete.name}
                        className="w-full bg-cyber-bg-darker border border-gray-700 focus:border-cyber-red p-2.5 text-white font-mono text-xs outline-none"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-cyber-red/20 pt-4 mt-2">
                    <CyberButton
                      type="button"
                      variant="cyan"
                      size="md"
                      onClick={() => {
                        setIsDeleteEventModalOpen(false);
                        setEventToDelete(null);
                        setDeleteConfirmInput("");
                      }}
                      disabled={actionLoading}
                    >
                      CANCEL
                    </CyberButton>
                    <CyberButton
                      type="button"
                      variant="red"
                      size="md"
                      onClick={handleConfirmDeleteEvent}
                      disabled={deleteConfirmInput.trim() !== eventToDelete.name.trim() || actionLoading}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> {actionLoading ? "DELETING..." : "DELETE EVENT"}
                    </CyberButton>
                  </div>
                </div>
              </div>
            )}
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
        {/* TAB 7: LEADERBOARD & RESULT PUBLISHING                         */}
        {/* ============================================================== */}
        {activeTab === "leaderboard" && (() => {
          const totalEvaluationsNeeded = teams.length * judges.length;
          const completedEvaluations = scores.length;
          const pendingEvaluations = Math.max(0, totalEvaluationsNeeded - completedEvaluations);
          const isFullyComplete = totalEvaluationsNeeded > 0 && pendingEvaluations === 0;
          const isPublished = Boolean(currentEvent?.resultsPublished || currentEvent?.resultsDeclared);
          const canPublish = (isFullyComplete || declareOverride) && teams.length > 0;

          // Status Badge per Requirement 21
          const statusBadge = isPublished ? (
            <span className="font-mono text-xs px-2.5 py-1 border font-bold uppercase tracking-wider border-cyber-green text-cyber-green bg-cyber-green/10 flex items-center gap-1.5">
              🏆 RESULTS PUBLISHED
            </span>
          ) : isFullyComplete ? (
            <span className="font-mono text-xs px-2.5 py-1 border font-bold uppercase tracking-wider border-cyber-green text-cyber-green bg-cyber-green/10 flex items-center gap-1.5">
              🟢 READY TO PUBLISH
            </span>
          ) : (
            <span className="font-mono text-xs px-2.5 py-1 border font-bold uppercase tracking-wider border-cyber-yellow text-cyber-yellow bg-cyber-yellow/10 flex items-center gap-1.5">
              🟡 EVALUATION IN PROGRESS
            </span>
          );

          return (
            <div className="flex flex-col gap-6">
              {/* Result Publishing Control Card */}
              <div className="cyber-glass border border-cyber-magenta/30 p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-cyber-magenta/20 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-cyber-magenta" />
                    <h2 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase">
                      FINAL RESULTS & PUBLISHING: {currentEvent?.name?.toUpperCase() || selectedEventId}
                    </h2>
                  </div>
                  {statusBadge}
                </div>

                {isPublished ? (
                  <div className="bg-cyber-green/10 border border-cyber-green/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyber-green animate-ping" />
                        <h3 className="font-orbitron font-bold text-sm text-cyber-green uppercase tracking-wider">
                          RESULTS PUBLISHED
                        </h3>
                      </div>
                      <p className="font-mono text-xs text-gray-300">
                        {currentEvent?.resultsPublishedAt || currentEvent?.declaredAt ? (
                          <>Published on: {new Date(currentEvent.resultsPublishedAt || currentEvent.declaredAt!).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</>
                        ) : (
                          <>Official publication timestamp recorded</>
                        )}
                      </p>
                      <span className="text-[10px] font-mono text-gray-400">
                        Rankings are final and unlocked for public suspense reveal. Evaluation marks are locked.
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                      <CyberButton
                        type="button"
                        variant="cyan"
                        size="sm"
                        onClick={() => window.open(`/results?event=${selectedEventId}`, "_blank")}
                        className="flex items-center gap-1.5"
                      >
                        <Trophy className="w-3.5 h-3.5" /> VIEW FINAL RESULTS
                      </CyberButton>
                      <CyberButton
                        type="button"
                        variant="red"
                        size="sm"
                        onClick={handleRevokeResults}
                        disabled={actionLoading}
                      >
                        RE-OPEN EVALUATION
                      </CyberButton>
                    </div>
                  </div>
                ) : (
                  <div className="bg-cyber-bg-darker/60 border border-cyber-magenta/20 p-4 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-orbitron text-xs font-bold text-white uppercase tracking-wider">
                            RESULTS NOT PUBLISHED
                          </h3>
                          <span className="text-[10px] font-mono text-gray-400">
                            • {completedEvaluations} / {totalEvaluationsNeeded} evaluations complete
                          </span>
                        </div>
                        <p className="font-mono text-xs text-gray-400 mt-0.5">
                          {teams.length} Teams registered • {judges.length} Judges assigned • {pendingEvaluations} pending evaluations
                        </p>
                      </div>

                      <CyberButton
                        type="button"
                        variant="yellow"
                        size="sm"
                        disabled={!canPublish || actionLoading}
                        onClick={() => setIsDeclareResultsModalOpen(true)}
                        className="flex items-center gap-1.5 shrink-0"
                      >
                        <Trophy className="w-4 h-4" /> PUBLISH RESULTS
                      </CyberButton>
                    </div>

                    {!isFullyComplete && (
                      <div className="border border-cyber-yellow/30 bg-cyber-yellow/10 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
                        <span className="text-cyber-yellow font-bold">
                          ⚠️ {pendingEvaluations} evaluation{pendingEvaluations === 1 ? " is" : "s are"} still pending.
                        </span>
                        <label className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer select-none shrink-0">
                          <input
                            type="checkbox"
                            checked={declareOverride}
                            onChange={(e) => setDeclareOverride(e.target.checked)}
                            className="accent-cyber-yellow cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-cyber-yellow uppercase">
                            ADMIN OVERRIDE
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Leaderboard Table */}
              <div className="cyber-glass border border-cyber-magenta/20 p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-cyber-magenta/15 pb-2">
                  <h3 className="font-orbitron text-sm font-bold text-cyber-magenta tracking-wide uppercase">
                    🏆 LEADERBOARD RANKINGS ({currentEvent?.name?.toUpperCase() || selectedEventId})
                  </h3>
                  <span className="font-mono text-xs text-gray-400">
                    {leaderboard.length} Ranked Teams
                  </span>
                </div>

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
                            <div className="flex items-center gap-2">
                              <span className="font-orbitron font-bold text-xs text-white uppercase">{entry.teamName}</span>
                              {entry.isTie && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 bg-cyber-yellow/20 text-cyber-yellow border border-cyber-yellow/40 font-bold">
                                  {entry.tieLabel || "TIE"}
                                </span>
                              )}
                            </div>
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

              {/* PUBLISH FINAL RESULTS CONFIRMATION DIALOG MODAL (Requirement 8) */}
              {isDeclareResultsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
                  <div className="w-full max-w-lg bg-cyber-bg-dark border border-cyber-yellow p-6 shadow-[0_0_35px_rgba(234,179,8,0.25)] flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-cyber-yellow/30 pb-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-cyber-yellow" />
                        <h3 className="font-orbitron text-base font-bold text-white uppercase tracking-wider">
                          PUBLISH FINAL RESULTS?
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsDeclareResultsModalOpen(false)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-3 font-mono text-xs text-gray-300">
                      <div className="p-3 bg-cyber-bg-darker border border-gray-800 flex flex-col gap-1">
                        <div className="text-white font-bold">Event: {currentEvent?.name || selectedEventId}</div>
                        <div>Evaluations: {completedEvaluations} / {totalEvaluationsNeeded}</div>
                        {declareOverride && pendingEvaluations > 0 && (
                          <div className="text-cyber-yellow font-bold">⚡ ADMIN OVERRIDE ACTIVE ({pendingEvaluations} pending evaluations)</div>
                        )}
                      </div>

                      <p className="text-gray-400">Once published:</p>
                      <ul className="list-disc pl-5 space-y-1 text-gray-300">
                        <li>Rankings become final</li>
                        <li>Results become visible on the Results page</li>
                        <li>Final ranking is locked</li>
                        <li>Podium reveal becomes available</li>
                      </ul>
                      <p className="text-xs text-gray-400 italic">This action should be treated as a final event state.</p>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-cyber-yellow/20 pt-4 mt-2">
                      <CyberButton
                        type="button"
                        variant="cyan"
                        size="md"
                        onClick={() => setIsDeclareResultsModalOpen(false)}
                        disabled={actionLoading}
                      >
                        CANCEL
                      </CyberButton>
                      <CyberButton
                        type="button"
                        variant="yellow"
                        size="md"
                        onClick={handleConfirmPublishResults}
                        disabled={actionLoading}
                        className="flex items-center gap-2"
                      >
                        <Trophy className="w-4 h-4" /> {actionLoading ? "PUBLISHING..." : "PUBLISH FINAL RESULTS"}
                      </CyberButton>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ============================================================== */}
        {/* TAB 8: BROADCAST SYSTEM & SCORES MANAGEMENT                    */}
        {/* ============================================================== */}
        {activeTab === "system" && (
          <div className="flex flex-col gap-6">
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
