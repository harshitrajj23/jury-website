"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { 
  Trophy, 
  Lock, 
  Radio, 
  RefreshCw, 
  Cpu, 
  Layers
} from "lucide-react";
import { getLeaderboard, getConfig, initDatabase, getEvents } from "@/lib/db";
import type { LeaderboardEntry, EventItem } from "@/lib/types";
import { useRealtimeSync } from "@/lib/useRealtimeSync";
import CyberButton from "@/components/CyberButton";

function LeaderboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramEventId = searchParams.get("event") || "default_event";

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(paramEventId);
  const [currentEvent, setCurrentEvent] = useState<EventItem | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [announced, setAnnounced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const confettiTriggeredRef = useRef(false);

  useEffect(() => {
    if (paramEventId && paramEventId !== selectedEventId) {
      setSelectedEventId(paramEventId);
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
      const [eventsList, config, data] = await Promise.all([
        getEvents(),
        getConfig(eventId),
        getLeaderboard(eventId),
      ]);

      setEvents(eventsList || []);
      const matched = eventsList.find((e) => e.id === eventId) || config.event || null;
      setCurrentEvent(matched);

      setAnnounced(config.announceResults);
      if (config.announceResults) {
        setLeaderboard(data || []);
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
    confettiTriggeredRef.current = false;
    router.push(`/results?event=${newEvId}`);
    fetchLeaderboard(newEvId);
  };

  useEffect(() => {
    if (announced && leaderboard.length > 0 && !confettiTriggeredRef.current) {
      confettiTriggeredRef.current = true;
      const duration = 4 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#eab308", "#06b6d4", "#d946ef", "#ffffff"]
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#eab308", "#06b6d4", "#d946ef", "#ffffff"]
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      
      // Delay the confetti until the 1st place team is revealed (3.5s)
      setTimeout(frame, 3500);
    }
  }, [announced, leaderboard.length]);

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

  // IF BLOCKED / ENCRYPTED
  if (!announced) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 relative font-mono overflow-x-hidden">
        <div className="absolute w-[250px] h-[250px] bg-cyber-red/5 rounded-full blur-[90px] top-[20%] left-[30%] pointer-events-none" />
        
        <div className="w-full max-w-lg cyber-glass border border-cyber-red/25 p-6 sm:p-8 relative flex flex-col items-center text-center gap-6">
          <span className="absolute top-0 left-0 w-2.5 h-2.5 bg-cyber-red" />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-cyber-red" />
          
          <div className="p-4 bg-cyber-red/10 border border-cyber-red/30 rounded-none animate-pulse">
            <Lock className="w-8 h-8 text-cyber-red" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2 text-cyber-red font-mono text-xs tracking-widest uppercase">
              <Radio className="w-4 h-4 animate-bounce" /> BROADCAST BLOCKADE IN EFFECT
            </div>
            <h1 className="font-orbitron font-extrabold text-xl sm:text-2xl text-white tracking-widest text-glow-red mt-2 uppercase">
              {currentEvent?.name || "TRANSMISSION LOCKED"}
            </h1>
            <p className="text-xs text-gray-500 font-sans leading-relaxed px-2 mt-1">
              Leaderboard aggregates for {currentEvent?.name || "this event"} are currently encrypted under master organizer lock. The results transmission channel will open instantly upon admin broadcast.
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

          <div className="w-full bg-cyber-bg-darker/60 border border-cyber-red/15 p-4 font-mono text-[10px] text-gray-400 text-left flex flex-col gap-1">
            <span className="text-cyber-red font-bold uppercase">📟 SEC-STATUS:</span>
            <span>⚡ EVENT: {currentEvent?.name?.toUpperCase() || selectedEventId.toUpperCase()}</span>
            <span>⚡ FEED: SCORESPHERE-RESULTS-8443</span>
            <span>⚡ REALTIME LINK: {realtimeStatus === "connected" ? "LIVE SSE ACTIVE" : "OFFLINE"}</span>
          </div>

          <div className="flex gap-4 w-full justify-center">
            <CyberButton
              variant="magenta"
              size="sm"
              onClick={() => fetchLeaderboard(selectedEventId)}
              disabled={refreshing}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> SCAN SIGNAL
            </CyberButton>
          </div>
        </div>
      </div>
    );
  }

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
              <span className="p-2 bg-cyber-magenta/10 text-cyber-magenta border border-cyber-magenta/20 shrink-0">
                <Trophy className="w-5 h-5 text-cyber-magenta text-glow-magenta animate-pulse" />
              </span>
            )}

            <div className="min-w-0">
              <h1 className="font-orbitron font-extrabold text-base sm:text-lg text-white tracking-widest text-glow-magenta uppercase truncate">
                {currentEvent?.name || "SCORESPHERE CHAMPIONS LIST"}
              </h1>
              <span className="font-mono text-[9px] text-cyber-magenta tracking-widest uppercase block mt-0.5 truncate">
                {realtimeStatus === "connected" ? "🔴 LIVE BROADCAST" : "OFFLINE"} • {currentEvent?.subtitle || currentEvent?.organizer || "FINAL RANKINGS"}
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

      {/* Main Leaderboard Grid */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 w-full mt-8 flex-grow flex flex-col gap-6">
        {leaderboard.length === 0 ? (
          <div className="cyber-glass border border-cyber-cyan/15 p-12 text-center flex flex-col items-center justify-center gap-4">
            <Cpu className="w-8 h-8 text-cyber-cyan animate-spin" />
            <p className="font-orbitron text-xs text-gray-400 uppercase tracking-widest">
              TABULATING TRANSMITTED DATA NODES FOR {currentEvent?.name?.toUpperCase() || selectedEventId.toUpperCase()}...
            </p>
          </div>
        ) : (
          <div className="flex flex-col w-full">
            {/* ========================================================= */}
            {/* THE HYPE PODIUM (TOP 3)                                   */}
            {/* ========================================================= */}
            {leaderboard.length > 0 && (
              <div className="flex flex-col md:flex-row justify-center items-end gap-6 mb-16 mt-8 px-2 md:px-8 min-h-[300px]">
                
                {/* 2ND PLACE (Left side) */}
                {leaderboard[1] && (
                  <motion.div 
                    initial={{ opacity: 0, y: 150 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.5, type: "spring", bounce: 0.4 }}
                    className="w-full md:w-1/3 flex flex-col items-center order-2 md:order-1"
                  >
                    <div 
                      className="cyber-glass border border-cyber-cyan/40 bg-cyber-cyan/10 w-full p-6 text-center shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col items-center relative overflow-hidden rounded-t-xl md:h-[220px] justify-end hover:-translate-y-2 transition-transform cursor-pointer" 
                      onClick={() => toggleTeam(leaderboard[1].teamId)}
                    >
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-cyber-cyan shadow-[0_0_10px_#06b6d4]" />
                      <div className="w-14 h-14 rounded-full bg-cyber-cyan/20 border-2 border-cyber-cyan text-cyber-cyan flex items-center justify-center font-orbitron font-extrabold text-2xl mb-4 shadow-[0_0_20px_#06b6d4]">2</div>
                      <h3 className="font-orbitron font-bold text-lg text-white uppercase w-full break-words leading-tight text-glow-cyan">{leaderboard[1].teamName}</h3>
                      <p className="font-mono text-sm text-cyber-cyan mt-3 font-bold bg-black/50 px-3 py-1 rounded-full">{leaderboard[1].averageScore} PTS</p>
                      
                      {!!expandedTeams[leaderboard[1].teamId] && (
                        <div className="w-full mt-4 border-t border-cyber-cyan/20 pt-3 text-left">
                          {leaderboard[1].judgeSubmissions.map((sub, i) => (
                            <div key={i} className="flex justify-between text-[10px] font-mono border-b border-white/5 py-1">
                              <span className="text-gray-400 truncate pr-2">{sub.judgeName}</span>
                              <span className="text-cyber-cyan font-bold">{sub.totalScore}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 1ST PLACE (Center) */}
                {leaderboard[0] && (
                  <motion.div 
                    initial={{ opacity: 0, y: 200, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 1, delay: 3.0, type: "spring", bounce: 0.5 }}
                    className="w-full md:w-1/3 flex flex-col items-center order-1 md:order-2 z-20"
                  >
                    <motion.div 
                      initial={{ opacity: 0, scale: 0 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      transition={{ delay: 3.8, duration: 0.5, type: "spring", bounce: 0.6 }}
                      className="text-center mb-4 text-cyber-yellow animate-bounce font-orbitron font-extrabold uppercase tracking-widest text-sm shadow-black drop-shadow-md"
                    >
                      👑 GRAND CHAMPION 👑
                    </motion.div>
                    
                    <div 
                      className="cyber-glass border-2 border-cyber-yellow/60 bg-cyber-yellow/15 w-full p-8 text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] flex flex-col items-center relative overflow-hidden rounded-t-xl md:h-[280px] justify-end transform md:scale-110 hover:-translate-y-2 transition-transform cursor-pointer" 
                      onClick={() => toggleTeam(leaderboard[0].teamId)}
                    >
                      <div className="absolute top-0 left-0 w-full h-2 bg-cyber-yellow shadow-[0_0_20px_#eab308]" />
                      <div className="absolute inset-0 bg-cyber-yellow/10 pointer-events-none animate-pulse" />
                      
                      <div className="w-20 h-20 rounded-full bg-cyber-yellow/20 border-2 border-cyber-yellow text-cyber-yellow flex items-center justify-center font-orbitron font-extrabold text-4xl mb-4 shadow-[0_0_30px_#eab308] relative z-10">1</div>
                      <h3 className="font-orbitron font-black text-2xl text-white uppercase w-full break-words leading-tight text-glow-yellow relative z-10">{leaderboard[0].teamName}</h3>
                      <p className="font-mono text-base text-cyber-yellow mt-3 font-extrabold bg-black/60 px-4 py-1.5 rounded-full relative z-10">{leaderboard[0].averageScore} PTS</p>

                      {!!expandedTeams[leaderboard[0].teamId] && (
                        <div className="w-full mt-4 border-t border-cyber-yellow/30 pt-3 text-left relative z-10">
                          {leaderboard[0].judgeSubmissions.map((sub, i) => (
                            <div key={i} className="flex justify-between text-[11px] font-mono border-b border-white/5 py-1">
                              <span className="text-gray-300 truncate pr-2">{sub.judgeName}</span>
                              <span className="text-cyber-yellow font-bold">{sub.totalScore}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 3RD PLACE (Right side) */}
                {leaderboard[2] && (
                  <motion.div 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, type: "spring", bounce: 0.4 }}
                    className="w-full md:w-1/3 flex flex-col items-center order-3 md:order-3"
                  >
                    <div 
                      className="cyber-glass border border-cyber-magenta/40 bg-cyber-magenta/10 w-full p-6 text-center shadow-[0_0_30px_rgba(217,70,239,0.15)] flex flex-col items-center relative overflow-hidden rounded-t-xl md:h-[180px] justify-end hover:-translate-y-2 transition-transform cursor-pointer" 
                      onClick={() => toggleTeam(leaderboard[2].teamId)}
                    >
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-cyber-magenta shadow-[0_0_10px_#d946ef]" />
                      <div className="w-12 h-12 rounded-full bg-cyber-magenta/20 border-2 border-cyber-magenta text-cyber-magenta flex items-center justify-center font-orbitron font-extrabold text-xl mb-4 shadow-[0_0_20px_#d946ef]">3</div>
                      <h3 className="font-orbitron font-bold text-base text-white uppercase w-full break-words leading-tight text-glow-magenta">{leaderboard[2].teamName}</h3>
                      <p className="font-mono text-sm text-cyber-magenta mt-3 font-bold bg-black/50 px-3 py-1 rounded-full">{leaderboard[2].averageScore} PTS</p>

                      {!!expandedTeams[leaderboard[2].teamId] && (
                        <div className="w-full mt-4 border-t border-cyber-magenta/20 pt-3 text-left">
                          {leaderboard[2].judgeSubmissions.map((sub, i) => (
                            <div key={i} className="flex justify-between text-[10px] font-mono border-b border-white/5 py-1">
                              <span className="text-gray-400 truncate pr-2">{sub.judgeName}</span>
                              <span className="text-cyber-magenta font-bold">{sub.totalScore}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* HONORABLE MENTIONS (RANKS 4+)                             */}
            {/* ========================================================= */}
            {leaderboard.length > 3 && (
              <div className="flex flex-col gap-3 mt-4">
                <div className="flex items-center gap-4 w-full mb-4">
                  <div className="h-px bg-gray-800 flex-grow" />
                  <span className="font-orbitron text-xs font-bold text-gray-500 uppercase tracking-widest px-4">
                    HONORABLE MENTIONS
                  </span>
                  <div className="h-px bg-gray-800 flex-grow" />
                </div>

                {leaderboard.slice(3).map((entry, idx) => {
                  const actualRank = idx + 4;
                  const isExpanded = !!expandedTeams[entry.teamId];
                  
                  return (
                    <div 
                      key={entry.teamId}
                      className="bg-cyber-bg-darker/60 border border-gray-800 p-4 flex flex-col gap-2 hover:border-gray-600 transition-colors cursor-pointer"
                      onClick={() => toggleTeam(entry.teamId)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="font-orbitron font-extrabold text-sm text-gray-500 w-8">
                            #{actualRank}
                          </span>
                          <div>
                            <h4 className="font-orbitron font-bold text-sm text-white uppercase">{entry.teamName}</h4>
                            <span className="text-[10px] text-gray-500 font-mono">
                              Evaluated by {entry.judgeSubmissions.length} jurists
                            </span>
                          </div>
                        </div>

                        <span className="font-mono text-sm text-gray-300 font-bold bg-white/5 px-3 py-1 rounded">
                          {entry.averageScore} PTS
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-800 pt-2 mt-2">
                          {entry.judgeSubmissions.map((sub, i) => (
                            <div key={i} className="flex justify-between text-[11px] font-mono py-0.5 text-gray-400">
                              <span>{sub.judgeName}</span>
                              <span className="text-white font-bold">{sub.totalScore}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
