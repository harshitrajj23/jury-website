"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { 
  Trophy, 
  Lock, 
  Radio, 
  RefreshCw, 
  Cpu, 
  Layers,
  Sparkles,
  ChevronRight,
  Flame,
  Award
} from "lucide-react";
import { getPublicResults, initDatabase, getEvents } from "@/lib/db";
import type { LeaderboardEntry, EventItem } from "@/lib/types";
import { useRealtimeSync } from "@/lib/useRealtimeSync";
import CyberButton from "@/components/CyberButton";

type RevealStage = "NOT_STARTED" | "STAGE_3RD" | "STAGE_2ND" | "STAGE_WINNER" | "FULL_RESULTS";

function LeaderboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramEventId = searchParams.get("event") || "default_event";

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(paramEventId);
  const [currentEvent, setCurrentEvent] = useState<EventItem | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [announced, setAnnounced] = useState(false);
  const [resultsDeclared, setResultsDeclared] = useState(false);
  const [declaredAt, setDeclaredAt] = useState<string | undefined>(undefined);
  const [revealStage, setRevealStage] = useState<RevealStage>("NOT_STARTED");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const confettiTriggeredRef = useRef(false);

  useEffect(() => {
    if (paramEventId && paramEventId !== selectedEventId) {
      setSelectedEventId(paramEventId);
      setRevealStage("NOT_STARTED");
      confettiTriggeredRef.current = false;
    }
  }, [paramEventId, selectedEventId]);

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  const fetchLeaderboard = useCallback(async (eventId: string = selectedEventId) => {
    setRefreshing(true);
    try {
      const eventsList = await getEvents();
      setEvents(eventsList || []);

      let effectiveEventId = eventId;
      if (eventsList && eventsList.length > 0 && !eventsList.some((e) => e.id === eventId)) {
        effectiveEventId = eventsList[0].id;
        setSelectedEventId(effectiveEventId);
      }

      const publicRes = await getPublicResults(effectiveEventId);
      const matched = (eventsList || []).find((e) => e.id === effectiveEventId) || publicRes.event || null;
      setCurrentEvent(matched);

      setAnnounced(publicRes.published);
      setResultsDeclared(publicRes.published);
      setDeclaredAt(publicRes.publishedAt);
      if (publicRes.published) {
        setLeaderboard(publicRes.leaderboard || []);
      } else {
        setLeaderboard([]);
      }
    } catch (err) {
      console.error("Failed to compile transmission:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    initDatabase();
    fetchLeaderboard(selectedEventId);
  }, [fetchLeaderboard, selectedEventId]);

  const handleEventChange = (newEvId: string) => {
    setSelectedEventId(newEvId);
    setRevealStage("NOT_STARTED");
    confettiTriggeredRef.current = false;
    router.push(`/results?event=${newEvId}`);
    fetchLeaderboard(newEvId);
  };

  // Realtime WebSocket sync scoped to event
  const handleRealtimeChange = useCallback(() => {
    fetchLeaderboard(selectedEventId);
  }, [fetchLeaderboard, selectedEventId]);

  const realtimeStatus = useRealtimeSync({
    tables: ["Score", "Settings", "Team", "Event"],
    eventId: selectedEventId,
    onDataChange: handleRealtimeChange,
    intervalMs: 20000,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-bg flex justify-center items-center font-mono text-cyber-cyan p-4">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-10 h-10 animate-spin" />
          <p className="font-orbitron tracking-widest text-sm uppercase">DECRYPTING BROADCAST CHANNEL...</p>
        </div>
      </div>
    );
  }

  // IF UNPUBLISHED (Requirement 18 & 20)
  if (!announced) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 relative font-mono overflow-x-hidden">
        <div className="absolute w-[300px] h-[300px] bg-cyber-red/5 rounded-full blur-[100px] top-[20%] left-[30%] pointer-events-none" />
        {currentEvent?.banner && (
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-15 filter blur-[2px] pointer-events-none"
            style={{ backgroundImage: `url(${currentEvent.banner})` }}
          />
        )}
        
        <div className="w-full max-w-lg cyber-glass border border-cyber-red/30 p-8 relative flex flex-col items-center text-center gap-6 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
          <span className="absolute top-0 left-0 w-2.5 h-2.5 bg-cyber-red" />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-cyber-red" />
          
          <div className="p-4 bg-cyber-red/10 border border-cyber-red/40 animate-pulse">
            <Lock className="w-8 h-8 text-cyber-red" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2 text-cyber-red font-mono text-xs tracking-widest uppercase">
              <Radio className="w-4 h-4 animate-bounce" /> OFFICIAL ANNOUNCEMENT PENDING
            </div>
            <h1 className="font-orbitron font-extrabold text-xl sm:text-2xl text-white tracking-widest uppercase mt-1">
              RESULTS NOT YET PUBLISHED
            </h1>
            <p className="text-sm text-gray-300 font-sans leading-relaxed px-2 mt-1">
              The final results for {currentEvent?.name || "this event"} have not been released yet.
            </p>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Please check back later.
            </p>
          </div>

          {/* Event Switcher Dropdown */}
          {events.length > 1 && (
            <div className="flex items-center gap-2 bg-cyber-bg-darker border border-gray-800 px-3 py-1.5 text-xs font-mono w-full justify-center">
              <Layers className="w-4 h-4 text-cyber-cyan" />
              <span className="text-gray-400">EVENT:</span>
              <label htmlFor="locked-event-select" className="sr-only">Choose Event</label>
              <select
                id="locked-event-select"
                aria-label="Choose Event"
                value={selectedEventId}
                onChange={(e) => handleEventChange(e.target.value)}
                className="bg-transparent text-white outline-none cursor-pointer text-xs font-bold"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id} className="bg-gray-900 text-white">
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="w-full bg-cyber-bg-darker/60 border border-cyber-red/20 p-3.5 font-mono text-[10px] text-gray-400 text-left flex flex-col gap-1">
            <span className="text-cyber-red font-bold uppercase">📟 EVENT STATUS:</span>
            <span>⚡ EVENT: {currentEvent?.name?.toUpperCase() || selectedEventId.toUpperCase()}</span>
            <span>⚡ STATUS: EVALUATION IN PROGRESS • UNPUBLISHED</span>
            <span>⚡ LINK: {realtimeStatus === "connected" ? "LIVE SSE ACTIVE" : "OFFLINE"}</span>
          </div>

          <div className="flex gap-4 w-full justify-center">
            <CyberButton
              variant="magenta"
              size="sm"
              onClick={() => fetchLeaderboard(selectedEventId)}
              disabled={refreshing}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> CHECK STATUS
            </CyberButton>
          </div>
        </div>
      </div>
    );
  }

  const rank1Teams = leaderboard.filter((e) => e.rank === 1);
  const rank2Teams = leaderboard.filter((e) => e.rank === 2);
  const rank3Teams = leaderboard.filter((e) => e.rank === 3);
  const hasThirdPlace = rank3Teams.length > 0;

  // IF RESULTS ANNOUNCED / DISPLAY LEADERBOARD
  return (
    <div className="min-h-screen flex flex-col pb-16 relative overflow-x-hidden">
      {/* Background neon glows */}
      <div className="absolute w-[400px] h-[400px] bg-cyber-cyan/5 rounded-full blur-[120px] top-0 left-[10%] pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] bg-cyber-magenta/5 rounded-full blur-[120px] bottom-0 right-[10%] pointer-events-none" />

      {/* Leaderboard Header with Event Branding */}
      <header className="border-b border-cyber-cyan/15 bg-cyber-bg-darker/95 backdrop-blur-md sticky top-0 z-35">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          {/* Left: Branding & Event Identity */}
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
                <span className="p-2 bg-cyber-magenta/10 text-cyber-magenta border border-cyber-magenta/20 shrink-0">
                  <Trophy className="w-5 h-5 text-cyber-magenta text-glow-magenta animate-pulse" />
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="font-orbitron font-extrabold text-base sm:text-lg text-white tracking-widest text-glow-magenta uppercase truncate">
                {currentEvent?.name || "CHAMPIONS PODIUM"}
              </h1>
              <span className="font-mono text-[9px] text-cyber-magenta tracking-widest uppercase block mt-0.5 truncate">
                {realtimeStatus === "connected" ? "🔴 LIVE BROADCAST" : "OFFLINE"} • {currentEvent?.organizer ? `${currentEvent.organizer} • ` : ""}{currentEvent?.subtitle || "FINAL RANKINGS"}
              </span>
            </div>
          </div>

          {/* Right: Event Switcher & Sync */}
          <div className="flex items-center gap-3 flex-wrap justify-between sm:justify-end">
            {events.length > 1 && (
              <div className="flex items-center gap-1.5 bg-cyber-bg-darker border border-cyber-magenta/30 px-2.5 py-1 text-xs font-mono">
                <Layers className="w-3.5 h-3.5 text-cyber-magenta shrink-0" />
                <label htmlFor="results-event-select" className="sr-only">Switch Event</label>
                <select
                  id="results-event-select"
                  aria-label="Switch Event"
                  value={selectedEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  className="bg-transparent text-gray-200 outline-none cursor-pointer pr-1 text-xs font-bold"
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
              variant="magenta"
              size="sm"
              onClick={() => fetchLeaderboard(selectedEventId)}
              disabled={refreshing}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> SYNC DATA
            </CyberButton>
          </div>
        </div>
      </header>

      {/* Event Banner Hero (when uploaded by organizer) */}
      {currentEvent?.banner && (
        <div className="relative w-full h-44 sm:h-56 md:h-64 overflow-hidden border-b border-cyber-cyan/30 shadow-[0_0_35px_rgba(6,182,212,0.15)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentEvent.banner}
            alt={`${currentEvent.name} Banner`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-cyber-bg via-cyber-bg/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-bg/80 via-transparent to-cyber-bg/80" />

          <div className="absolute bottom-4 left-0 right-0 max-w-5xl mx-auto px-4 sm:px-6 flex items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              {currentEvent?.logo && (
                <div className="p-1.5 bg-black/75 backdrop-blur-md border border-cyber-cyan/50 shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentEvent.logo} alt="" className="h-10 sm:h-12 max-w-[120px] object-contain" />
                </div>
              )}
              <div className="text-left">
                <h2 className="font-orbitron font-extrabold text-lg sm:text-2xl text-white uppercase text-glow-cyan drop-shadow-md">
                  {currentEvent.name}
                </h2>
                {currentEvent.subtitle && (
                  <p className="font-mono text-xs text-cyber-cyan/90 drop-shadow">
                    {currentEvent.subtitle}
                  </p>
                )}
              </div>
            </div>
            {currentEvent.organizer && (
              <span className="hidden sm:inline-block font-mono text-[10px] text-gray-300 bg-black/70 backdrop-blur px-3 py-1 border border-white/20 uppercase font-semibold">
                Organized by {currentEvent.organizer}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content: Suspense Reveal or Full Rankings */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 w-full mt-8 flex-grow flex flex-col gap-6">
        {leaderboard.length === 0 ? (
          <div className="cyber-glass border border-cyber-cyan/15 p-12 text-center flex flex-col items-center justify-center gap-4">
            <Cpu className="w-8 h-8 text-cyber-cyan animate-spin" />
            <p className="font-orbitron text-xs text-gray-400 uppercase tracking-widest">
              TABULATING TRANSMITTED DATA NODES FOR {currentEvent?.name?.toUpperCase() || selectedEventId.toUpperCase()}...
            </p>
          </div>
        ) : revealStage !== "FULL_RESULTS" ? (
          /* CINEMATIC STAGED RESULTS REVEAL (Requirements 10-16, 22-23) */
          <div className="w-full flex flex-col items-center justify-center py-6">
            <AnimatePresence mode="wait">
              {revealStage === "NOT_STARTED" && (
                <motion.div
                  key="stage_not_started"
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="w-full max-w-xl mx-auto cyber-glass border border-cyber-cyan/40 p-8 sm:p-12 text-center flex flex-col items-center gap-6 relative shadow-[0_0_50px_rgba(6,182,212,0.15)]"
                >
                  <span className="absolute top-0 left-0 w-3 h-3 bg-cyber-cyan" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-cyber-cyan" />

                  <div className="w-20 h-20 rounded-full bg-cyber-cyan/10 border-2 border-cyber-cyan/50 flex items-center justify-center text-cyber-cyan shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-pulse">
                    <Trophy className="w-10 h-10 text-cyber-cyan" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-mono tracking-widest text-cyber-cyan uppercase font-bold flex items-center justify-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" /> OFFICIAL CHAMPIONSHIP TRANSMISSION
                    </span>
                    <h2 className="font-orbitron font-extrabold text-2xl sm:text-3xl text-white tracking-widest uppercase">
                      RESULTS REVEAL
                    </h2>
                    <p className="text-gray-300 font-mono text-sm mt-1">
                      THE FINAL RESULTS ARE IN
                    </p>
                    <p className="text-xs text-gray-400 font-sans">
                      Are you ready to reveal the podium standings for <span className="text-white font-semibold">{currentEvent?.name}</span>?
                    </p>
                  </div>

                  <div className="pt-2">
                    <CyberButton
                      variant="cyan"
                      size="lg"
                      onClick={() => {
                        if (hasThirdPlace) {
                          setRevealStage("STAGE_3RD");
                        } else if (rank2Teams.length > 0) {
                          setRevealStage("STAGE_2ND");
                        } else {
                          setRevealStage("STAGE_WINNER");
                        }
                      }}
                      className="flex items-center gap-2 text-sm tracking-widest font-bold px-8 py-3.5 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                    >
                      <Sparkles className="w-4 h-4" /> BEGIN REVEAL
                    </CyberButton>
                  </div>
                </motion.div>
              )}

              {revealStage === "STAGE_3RD" && (
                <motion.div
                  key="stage_3rd"
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="w-full max-w-xl mx-auto cyber-glass border border-amber-700/50 p-8 sm:p-10 text-center flex flex-col items-center gap-6 relative shadow-[0_0_50px_rgba(180,83,9,0.2)]"
                >
                  <span className="absolute top-0 left-0 w-3 h-3 bg-amber-500" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-amber-500" />

                  <div className="flex items-center gap-2 text-amber-400 font-mono text-xs tracking-widest uppercase font-bold">
                    STAGE 1 OF 3 • PODIUM REVEAL
                  </div>

                  <div className="w-16 h-16 rounded-full bg-amber-950/40 border-2 border-amber-500 flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(245,158,11,0.3)]">
                    🥉
                  </div>

                  <div className="flex flex-col gap-1">
                    <h3 className="font-orbitron font-extrabold text-xl sm:text-2xl text-amber-300 tracking-wider uppercase">
                      {rank3Teams.length > 1 ? "3RD PLACE — TIE" : "3RD PLACE"}
                    </h3>
                    <span className="text-xs text-gray-400 font-mono">
                      BRONZE PODIUM STANDING
                    </span>
                  </div>

                  <div className="w-full flex flex-col gap-3">
                    {rank3Teams.map((t) => (
                      <div 
                        key={t.teamId}
                        className="bg-cyber-bg-darker/80 border border-amber-700/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg"
                      >
                        <div className="text-center sm:text-left min-w-0">
                          <h4 className="font-orbitron font-bold text-lg sm:text-xl text-white uppercase truncate">
                            {t.teamName}
                          </h4>
                          {t.projectName && (
                            <p className="text-xs text-cyber-cyan font-mono mt-0.5 line-clamp-1">{t.projectName}</p>
                          )}
                          {t.isTie && (
                            <span className="inline-block mt-1 text-[9px] font-mono px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                              TIED 3RD PLACE
                            </span>
                          )}
                        </div>
                        <div className="text-center sm:text-right shrink-0">
                          <span className="text-[10px] text-gray-400 font-mono block uppercase">FINAL SCORE</span>
                          <span className="font-orbitron font-extrabold text-2xl text-amber-400">
                            {t.averageScore} <span className="text-xs font-mono font-normal text-gray-400">PTS</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 w-full flex justify-center">
                    <CyberButton
                      variant="cyan"
                      size="lg"
                      onClick={() => {
                        if (rank2Teams.length > 0) {
                          setRevealStage("STAGE_2ND");
                        } else {
                          setRevealStage("STAGE_WINNER");
                        }
                      }}
                      className="flex items-center gap-2 text-sm tracking-widest font-bold px-8 py-3 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                    >
                      REVEAL 2ND PLACE <ChevronRight className="w-4 h-4" />
                    </CyberButton>
                  </div>
                </motion.div>
              )}

              {revealStage === "STAGE_2ND" && (
                <motion.div
                  key="stage_2nd"
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="w-full max-w-xl mx-auto cyber-glass border border-cyan-500/50 p-8 sm:p-10 text-center flex flex-col items-center gap-6 relative shadow-[0_0_50px_rgba(6,182,212,0.2)]"
                >
                  <span className="absolute top-0 left-0 w-3 h-3 bg-cyan-400" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-cyan-400" />

                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[11px] font-mono tracking-widest text-cyber-cyan uppercase font-bold">
                      STAGE 2 OF 3 • RUNNER-UP REVEAL
                    </span>
                    <p className="text-xs text-gray-400 font-mono uppercase tracking-wider mt-1">
                      AND NOW... WHO TOOK SECOND PLACE?
                    </p>
                  </div>

                  <div className="w-16 h-16 rounded-full bg-cyan-950/40 border-2 border-cyan-400 flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(6,182,212,0.3)]">
                    🥈
                  </div>

                  <div className="flex flex-col gap-1">
                    <h3 className="font-orbitron font-extrabold text-xl sm:text-2xl text-cyan-200 tracking-wider uppercase">
                      {rank2Teams.length > 1 ? "2ND PLACE — TIE" : "2ND PLACE"}
                    </h3>
                    <span className="text-xs text-gray-400 font-mono">
                      SILVER PODIUM RUNNER-UP
                    </span>
                  </div>

                  <div className="w-full flex flex-col gap-3">
                    {rank2Teams.map((t) => (
                      <div 
                        key={t.teamId}
                        className="bg-cyber-bg-darker/80 border border-cyan-500/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg"
                      >
                        <div className="text-center sm:text-left min-w-0">
                          <h4 className="font-orbitron font-bold text-lg sm:text-xl text-white uppercase truncate">
                            {t.teamName}
                          </h4>
                          {t.projectName && (
                            <p className="text-xs text-cyber-cyan font-mono mt-0.5 line-clamp-1">{t.projectName}</p>
                          )}
                          {t.isTie && (
                            <span className="inline-block mt-1 text-[9px] font-mono px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold uppercase">
                              TIED 2ND PLACE
                            </span>
                          )}
                        </div>
                        <div className="text-center sm:text-right shrink-0">
                          <span className="text-[10px] text-gray-400 font-mono block uppercase">FINAL SCORE</span>
                          <span className="font-orbitron font-extrabold text-2xl text-cyan-300">
                            {t.averageScore} <span className="text-xs font-mono font-normal text-gray-400">PTS</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 w-full flex justify-center">
                    <CyberButton
                      variant="yellow"
                      size="lg"
                      onClick={() => {
                        setRevealStage("STAGE_WINNER");
                        confetti({
                          particleCount: 100,
                          spread: 75,
                          origin: { y: 0.6 },
                          colors: ["#eab308", "#06b6d4", "#d946ef", "#ffffff"]
                        });
                      }}
                      className="flex items-center gap-2 text-sm tracking-widest font-bold px-8 py-3 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                    >
                      🏆 REVEAL WINNER <ChevronRight className="w-4 h-4" />
                    </CyberButton>
                  </div>
                </motion.div>
              )}

              {revealStage === "STAGE_WINNER" && (
                <motion.div
                  key="stage_winner"
                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
                  className="w-full max-w-xl mx-auto cyber-glass border-2 border-cyber-yellow p-8 sm:p-12 text-center flex flex-col items-center gap-6 relative shadow-[0_0_70px_rgba(234,179,8,0.35)]"
                >
                  <span className="absolute top-0 left-0 w-3.5 h-3.5 bg-cyber-yellow" />
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-cyber-yellow" />

                  <div className="flex flex-col gap-1 items-center">
                    <span className="text-[11px] font-mono tracking-widest text-cyber-yellow uppercase font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyber-yellow animate-spin" /> FINAL STAGE • CHAMPIONSHIP REVEAL
                    </span>
                    <p className="text-xs text-gray-300 font-mono uppercase tracking-wider mt-1">
                      ONE TEAM REMAINS... WHO IS THE CHAMPION?
                    </p>
                  </div>

                  <div className="w-24 h-24 rounded-full bg-cyber-yellow/15 border-2 border-cyber-yellow flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(234,179,8,0.5)] animate-bounce">
                    🏆
                  </div>

                  <div className="flex flex-col gap-1">
                    <h3 className="font-orbitron font-extrabold text-2xl sm:text-3xl text-cyber-yellow tracking-widest uppercase text-glow-yellow">
                      {rank1Teams.length > 1 ? "CO-CHAMPIONS — TIE" : "CHAMPION"}
                    </h3>
                    <span className="text-xs text-gray-300 font-mono tracking-wider uppercase">
                      GRAND CHAMPION OF {currentEvent?.name?.toUpperCase()}
                    </span>
                  </div>

                  <div className="w-full flex flex-col gap-4">
                    {rank1Teams.map((t) => (
                      <div 
                        key={t.teamId}
                        className="bg-gradient-to-r from-cyber-yellow/20 via-cyber-bg-darker to-cyber-yellow/20 border-2 border-cyber-yellow p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_30px_rgba(234,179,8,0.25)]"
                      >
                        <div className="text-center sm:text-left min-w-0">
                          <h4 className="font-orbitron font-extrabold text-xl sm:text-2xl text-white uppercase truncate text-glow-yellow">
                            {t.teamName}
                          </h4>
                          {t.projectName && (
                            <p className="text-sm text-cyber-cyan font-mono mt-1 font-semibold line-clamp-1">{t.projectName}</p>
                          )}
                          {t.isTie && (
                            <span className="inline-block mt-2 text-[10px] font-mono px-2.5 py-0.5 bg-cyber-yellow/30 text-cyber-yellow border border-cyber-yellow font-bold uppercase">
                              TIED 1ST PLACE • CO-CHAMPION
                            </span>
                          )}
                        </div>
                        <div className="text-center sm:text-right shrink-0">
                          <span className="text-[10px] text-gray-400 font-mono block uppercase">FINAL WINNING SCORE</span>
                          <span className="font-orbitron font-extrabold text-3xl text-cyber-yellow text-glow-yellow">
                            {t.averageScore} <span className="text-xs font-mono font-normal text-gray-300">PTS</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 w-full flex justify-center">
                    <CyberButton
                      variant="cyan"
                      size="lg"
                      onClick={() => setRevealStage("FULL_RESULTS")}
                      className="flex items-center gap-2 text-sm tracking-widest font-bold px-10 py-3.5 shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                    >
                      VIEW FULL RESULTS →
                    </CyberButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col w-full">
            {/* Top Bar with Replay Reveal Option */}
            <div className="flex items-center justify-between bg-cyber-bg-darker/80 border border-cyber-cyan/30 px-4 py-2.5 mb-6 flex-wrap gap-2">
              <div className="flex items-center gap-2 font-mono text-xs text-cyber-cyan">
                <Award className="w-4 h-4 text-cyber-yellow" />
                <span className="font-bold uppercase tracking-wider">FULL COMPETITION LEADERBOARD REVEALED</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRevealStage("NOT_STARTED");
                  confettiTriggeredRef.current = false;
                }}
                className="text-[11px] font-mono text-gray-400 hover:text-white uppercase transition-colors flex items-center gap-1 cursor-pointer"
              >
                ↺ REPLAY REVEAL EXPERIENCE
              </button>
            </div>

            {/* OFFICIAL RESULT DECLARATION BANNER */}
            {resultsDeclared ? (
              <div className="bg-cyber-green/10 border border-cyber-green/40 p-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyber-green/20 border border-cyber-green flex items-center justify-center text-cyber-green shrink-0">
                    <Trophy className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <span className="font-orbitron font-extrabold text-sm sm:text-base text-cyber-green tracking-widest uppercase">
                        OFFICIAL RESULTS DECLARED
                      </span>
                      <span className="px-2 py-0.5 bg-cyber-green/20 border border-cyber-green text-cyber-green text-[10px] font-mono font-bold uppercase">
                        FINAL
                      </span>
                    </div>
                    <p className="font-mono text-xs text-gray-300 mt-0.5">
                      {declaredAt ? `Declared on ${new Date(declaredAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : "Official Verdict Confirmed"}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-cyber-cyan border border-cyber-cyan/30 px-3 py-1 bg-cyber-cyan/10 uppercase font-bold tracking-wider">
                  🔒 VERIFIED BY AUDIT
                </span>
              </div>
            ) : (
              <div className="bg-cyber-yellow/10 border border-cyber-yellow/40 p-3 mb-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyber-yellow animate-ping" />
                  <span className="font-orbitron font-bold text-xs text-cyber-yellow tracking-wider uppercase">
                    PROVISIONAL LIVE STANDINGS • FINAL RESULTS PENDING OFFICIAL DECLARATION
                  </span>
                </div>
                <span className="text-[10px] font-mono text-gray-400">
                  Scores update in real time as evaluations are transmitted
                </span>
              </div>
            )}

            {/* ========================================================= */}
            {/* THE HYPE PODIUM (TOP 3 & TIED PODIUM TEAMS)               */}
            {/* ========================================================= */}
            {leaderboard.length > 0 && (() => {
              const podiumTeams = leaderboard.filter((e) => e.rank <= 3);
              const rank1Teams = podiumTeams.filter((e) => e.rank === 1);
              const rank2Teams = podiumTeams.filter((e) => e.rank === 2);
              const rank3Teams = podiumTeams.filter((e) => e.rank === 3);

              // Standard 3-slot stepped podium layout if exactly 1 team per podium rank
              const isStandardThree = rank1Teams.length === 1 && rank2Teams.length === 1 && rank3Teams.length === 1;

              if (isStandardThree) {
                const first = rank1Teams[0];
                const second = rank2Teams[0];
                const third = rank3Teams[0];

                return (
                  <div className="flex flex-col md:flex-row justify-center items-end gap-6 mb-16 mt-4 px-2 md:px-8 min-h-[300px]">
                    {/* 2ND PLACE (Left side) */}
                    <motion.div 
                      initial={{ opacity: 0, y: 150 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 1.0, type: "spring", bounce: 0.4 }}
                      className="w-full md:w-1/3 flex flex-col items-center order-2 md:order-1"
                    >
                      <div 
                        className="cyber-glass border border-cyber-cyan/50 bg-cyber-cyan/10 w-full p-6 text-center shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col items-center relative overflow-hidden rounded-t-xl md:h-[230px] justify-end hover:-translate-y-2 transition-transform cursor-pointer" 
                        onClick={() => toggleTeam(second.teamId)}
                      >
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-cyber-cyan shadow-[0_0_10px_#06b6d4]" />
                        <div className="w-14 h-14 rounded-full bg-cyber-cyan/20 border-2 border-cyber-cyan text-cyber-cyan flex items-center justify-center font-orbitron font-extrabold text-2xl mb-3 shadow-[0_0_20px_#06b6d4]">
                          🥈 2
                        </div>
                        <h3 className="font-orbitron font-bold text-lg text-white uppercase w-full break-words leading-tight text-glow-cyan">
                          {second.teamName}
                        </h3>
                        <p className="font-mono text-sm text-cyber-cyan mt-2 font-bold bg-black/50 px-3 py-1 rounded-full">
                          {second.averageScore} PTS
                        </p>
                        
                        {!!expandedTeams[second.teamId] && (
                          <div className="w-full mt-3 border-t border-cyber-cyan/20 pt-2 text-left">
                            {second.judgeSubmissions.map((sub, i) => (
                              <div key={i} className="flex justify-between text-[10px] font-mono border-b border-white/5 py-1">
                                <span className="text-gray-400 truncate pr-2">{sub.judgeName}</span>
                                <span className="text-cyber-cyan font-bold">{sub.totalScore}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* 1ST PLACE (Center) */}
                    <motion.div 
                      initial={{ opacity: 0, y: 200, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 1, delay: 1.8, type: "spring", bounce: 0.5 }}
                      className="w-full md:w-1/3 flex flex-col items-center order-1 md:order-2 z-20"
                    >
                      <motion.div 
                        initial={{ opacity: 0, scale: 0 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        transition={{ delay: 2.4, duration: 0.5, type: "spring", bounce: 0.6 }}
                        className="text-center mb-3 text-cyber-yellow animate-bounce font-orbitron font-extrabold uppercase tracking-widest text-sm shadow-black drop-shadow-md"
                      >
                        👑 GRAND CHAMPION 👑
                      </motion.div>
                      
                      <div 
                        className="cyber-glass border-2 border-cyber-yellow/70 bg-cyber-yellow/15 w-full p-8 text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] flex flex-col items-center relative overflow-hidden rounded-t-xl md:h-[290px] justify-end transform md:scale-110 hover:-translate-y-2 transition-transform cursor-pointer" 
                        onClick={() => toggleTeam(first.teamId)}
                      >
                        <div className="absolute top-0 left-0 w-full h-2 bg-cyber-yellow shadow-[0_0_20px_#eab308]" />
                        <div className="absolute inset-0 bg-cyber-yellow/10 pointer-events-none animate-pulse" />
                        
                        <div className="w-20 h-20 rounded-full bg-cyber-yellow/20 border-2 border-cyber-yellow text-cyber-yellow flex items-center justify-center font-orbitron font-extrabold text-4xl mb-3 shadow-[0_0_30px_#eab308] relative z-10">
                          🥇 1
                        </div>
                        <h3 className="font-orbitron font-black text-2xl text-white uppercase w-full break-words leading-tight text-glow-yellow relative z-10">
                          {first.teamName}
                        </h3>
                        <p className="font-mono text-base text-cyber-yellow mt-2 font-extrabold bg-black/60 px-4 py-1.5 rounded-full relative z-10">
                          {first.averageScore} PTS
                        </p>

                        {!!expandedTeams[first.teamId] && (
                          <div className="w-full mt-3 border-t border-cyber-yellow/30 pt-2 text-left relative z-10">
                            {first.judgeSubmissions.map((sub, i) => (
                              <div key={i} className="flex justify-between text-[11px] font-mono border-b border-white/5 py-1">
                                <span className="text-gray-300 truncate pr-2">{sub.judgeName}</span>
                                <span className="text-cyber-yellow font-bold">{sub.totalScore}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* 3RD PLACE (Right side) */}
                    <motion.div 
                      initial={{ opacity: 0, y: 100 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.4, type: "spring", bounce: 0.4 }}
                      className="w-full md:w-1/3 flex flex-col items-center order-3 md:order-3"
                    >
                      <div 
                        className="cyber-glass border border-cyber-magenta/50 bg-cyber-magenta/10 w-full p-6 text-center shadow-[0_0_30px_rgba(217,70,239,0.15)] flex flex-col items-center relative overflow-hidden rounded-t-xl md:h-[190px] justify-end hover:-translate-y-2 transition-transform cursor-pointer" 
                        onClick={() => toggleTeam(third.teamId)}
                      >
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-cyber-magenta shadow-[0_0_10px_#d946ef]" />
                        <div className="w-12 h-12 rounded-full bg-cyber-magenta/20 border-2 border-cyber-magenta text-cyber-magenta flex items-center justify-center font-orbitron font-extrabold text-xl mb-3 shadow-[0_0_20px_#d946ef]">
                          🥉 3
                        </div>
                        <h3 className="font-orbitron font-bold text-base text-white uppercase w-full break-words leading-tight text-glow-magenta">
                          {third.teamName}
                        </h3>
                        <p className="font-mono text-sm text-cyber-magenta mt-2 font-bold bg-black/50 px-3 py-1 rounded-full">
                          {third.averageScore} PTS
                        </p>

                        {!!expandedTeams[third.teamId] && (
                          <div className="w-full mt-3 border-t border-cyber-magenta/20 pt-2 text-left">
                            {third.judgeSubmissions.map((sub, i) => (
                              <div key={i} className="flex justify-between text-[10px] font-mono border-b border-white/5 py-1">
                                <span className="text-gray-400 truncate pr-2">{sub.judgeName}</span>
                                <span className="text-cyber-magenta font-bold">{sub.totalScore}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                );
              }

              // Multi-podium / Tied podium layout: Expands to show all tied podium teams (rank <= 3)
              return (
                <div className="mb-14 mt-4">
                  <div className="text-center mb-6">
                    <span className="font-orbitron text-xs font-bold text-cyber-cyan uppercase tracking-widest px-3 py-1 bg-cyber-cyan/10 border border-cyber-cyan/30">
                      🏆 CHAMPIONS PODIUM (RANK 1–3 INCLUDING TIES)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {podiumTeams.map((entry, idx) => {
                      const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉";
                      const colorClass = entry.rank === 1 
                        ? "border-cyber-yellow bg-cyber-yellow/10 text-cyber-yellow"
                        : entry.rank === 2
                        ? "border-cyber-cyan bg-cyber-cyan/10 text-cyber-cyan"
                        : "border-cyber-magenta bg-cyber-magenta/10 text-cyber-magenta";

                      return (
                        <motion.div
                          key={entry.teamId}
                          initial={{ opacity: 0, y: 50 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: idx * 0.2, type: "spring" }}
                          className={`cyber-glass border p-6 flex flex-col justify-between rounded-t-xl hover:-translate-y-1 transition-transform cursor-pointer ${colorClass}`}
                          onClick={() => toggleTeam(entry.teamId)}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-2xl font-orbitron font-extrabold flex items-center gap-1.5">
                                <span>{medal}</span>
                                <span>{entry.rank}</span>
                              </span>
                              {entry.isTie && (
                                <span className="font-mono text-[9px] px-2 py-0.5 border font-bold uppercase tracking-wider bg-black/40">
                                  {entry.tieLabel || `TIED ${entry.rank}`}
                                </span>
                              )}
                            </div>

                            <h3 className="font-orbitron font-bold text-lg text-white uppercase break-words leading-tight">
                              {entry.teamName}
                            </h3>
                            {entry.projectName && (
                              <p className="text-xs text-gray-400 font-mono mt-1">{entry.projectName}</p>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-gray-400">
                              {entry.judgeSubmissions.length} Jurists
                            </span>
                            <span className="font-orbitron font-bold text-base bg-black/50 px-3 py-1 rounded">
                              {entry.averageScore} PTS
                            </span>
                          </div>

                          {!!expandedTeams[entry.teamId] && (
                            <div className="w-full mt-3 border-t border-white/10 pt-2 text-left">
                              {entry.judgeSubmissions.map((sub, i) => (
                                <div key={i} className="flex justify-between text-[10px] font-mono border-b border-white/5 py-1">
                                  <span className="text-gray-400 truncate pr-2">{sub.judgeName}</span>
                                  <span className="font-bold">{sub.totalScore}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ========================================================= */}
            {/* FULL RANKINGS (TABLE / LIST)                              */}
            {/* ========================================================= */}
            <div className="flex flex-col gap-4 mt-6">
              <div className="flex items-center justify-between border-b border-cyber-magenta/20 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-cyber-magenta" />
                  <h3 className="font-orbitron text-sm font-bold text-white uppercase tracking-wider">
                    {resultsDeclared ? "FINAL RANKINGS" : "LEADERBOARD STANDINGS"} ({leaderboard.length} TEAMS)
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-gray-400">
                  Click any team row to inspect individual jurist evaluations
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {leaderboard.map((entry) => {
                  const isExpanded = !!expandedTeams[entry.teamId];
                  const rankNum = entry.rank;
                  const medalEmoji = rankNum === 1 ? "🥇" : rankNum === 2 ? "🥈" : rankNum === 3 ? "🥉" : null;

                  return (
                    <div
                      key={entry.teamId}
                      className={`border p-4 transition-all cursor-pointer ${
                        rankNum === 1
                          ? "bg-cyber-yellow/5 border-cyber-yellow/40 hover:border-cyber-yellow"
                          : rankNum === 2
                          ? "bg-cyber-cyan/5 border-cyber-cyan/40 hover:border-cyber-cyan"
                          : rankNum === 3
                          ? "bg-cyber-magenta/5 border-cyber-magenta/40 hover:border-cyber-magenta"
                          : "bg-cyber-bg-darker/60 border-gray-800 hover:border-gray-700"
                      }`}
                      onClick={() => toggleTeam(entry.teamId)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded flex items-center justify-center font-orbitron font-extrabold text-sm shrink-0 border ${
                              rankNum === 1
                                ? "bg-cyber-yellow/20 border-cyber-yellow text-cyber-yellow shadow-[0_0_12px_rgba(234,179,8,0.3)]"
                                : rankNum === 2
                                ? "bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                                : rankNum === 3
                                ? "bg-cyber-magenta/20 border-cyber-magenta text-cyber-magenta shadow-[0_0_12px_rgba(217,70,239,0.3)]"
                                : "bg-black/40 border-gray-800 text-gray-400"
                            }`}
                          >
                            {medalEmoji ? `${medalEmoji} ${rankNum}` : `#${rankNum}`}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-orbitron font-bold text-sm text-white uppercase truncate">
                                {entry.teamName}
                              </h4>
                              {entry.isTie && (
                                <span className="text-[9px] font-mono px-2 py-0.5 bg-cyber-yellow/20 text-cyber-yellow border border-cyber-yellow/40 font-bold uppercase">
                                  {entry.tieLabel || `TIED ${entry.rank}`}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono text-gray-400 mt-0.5 flex-wrap">
                              {entry.projectName && <span className="text-gray-300">{entry.projectName}</span>}
                              {entry.projectName && <span>•</span>}
                              <span className="text-cyber-cyan">
                                {entry.judgeSubmissions.length} Jurists evaluated
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                          <div className="text-right">
                            <span className="text-[9px] text-gray-500 font-mono uppercase block">
                              WEIGHTED SCORE
                            </span>
                            <span
                              className={`font-orbitron font-extrabold text-base ${
                                rankNum === 1
                                  ? "text-cyber-yellow"
                                  : rankNum === 2
                                  ? "text-cyber-cyan"
                                  : rankNum === 3
                                  ? "text-cyber-magenta"
                                  : "text-white"
                              }`}
                            >
                              {entry.averageScore} PTS
                            </span>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-white/10 pt-3 mt-3">
                          <p className="text-[10px] font-mono text-gray-400 uppercase mb-2">
                            Individual Jurist Breakdowns:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {entry.judgeSubmissions.map((sub, i) => (
                              <div
                                key={i}
                                className="bg-black/50 border border-gray-800 p-2 text-xs font-mono flex justify-between items-center"
                              >
                                <span className="text-gray-300 truncate pr-2">{sub.judgeName}</span>
                                <span className="text-cyber-cyan font-bold shrink-0">{sub.totalScore} pts</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cyber-bg flex justify-center items-center font-mono text-cyber-cyan p-4">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    }>
      <LeaderboardContent />
    </Suspense>
  );
}
