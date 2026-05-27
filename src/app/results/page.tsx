"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { 
  Trophy, 
  Lock, 
  Radio, 
  ArrowLeft, 
  RefreshCw, 
  Cpu, 
  Gamepad2, 
  UserCheck,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { getLeaderboard, getConfig, initDatabase, LeaderboardEntry } from "@/lib/db";
import { useRealtimeSync } from "@/lib/useRealtimeSync";
import CyberButton from "@/components/CyberButton";

export default function LeaderboardPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [announced, setAnnounced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  useEffect(() => {
    initDatabase();
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (announced && leaderboard.length > 0) {
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

  const fetchLeaderboard = async () => {
    setRefreshing(true);
    try {
      const config = await getConfig();
      setAnnounced(config.announceResults);
      
      if (config.announceResults) {
        const data = await getLeaderboard();
        setLeaderboard(data);
      }
    } catch (err) {
      console.error("Failed to compile transmission:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Realtime WebSocket sync — auto-refresh when scores or config change
  const handleRealtimeChange = useCallback(() => {
    fetchLeaderboard();
  }, []);

  const realtimeStatus = useRealtimeSync({
    tables: ["pals_scores", "pals_config"],
    onDataChange: handleRealtimeChange,
  });

  const hasJudgeSession = typeof window !== "undefined" && !!sessionStorage.getItem("judge_session");

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-bg flex justify-center items-center font-mono text-cyber-cyan">
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
      <div className="min-h-screen flex flex-col justify-center items-center p-4 relative">
        <div className="absolute w-[250px] h-[250px] bg-cyber-red/5 rounded-full blur-[90px] top-[20%] left-[30%] pointer-events-none" />
        
        <div className="w-full max-w-lg cyber-glass border border-cyber-red/25 p-8 relative flex flex-col items-center text-center gap-6">
          {/* Neon warning accents */}
          <span className="absolute top-0 left-0 w-2.5 h-2.5 bg-cyber-red" />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-cyber-red" />
          
          <div className="p-4 bg-cyber-red/10 border border-cyber-red/30 rounded-none animate-pulse">
            <Lock className="w-8 h-8 text-cyber-red" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2 text-cyber-red font-mono text-xs tracking-widest uppercase">
              <Radio className="w-4 h-4 animate-bounce" /> BROADCAST BLOCKADE IN EFFECT
            </div>
            <h1 className="font-orbitron font-extrabold text-2xl text-white tracking-widest text-glow-red mt-2 uppercase">
              TRANSMISSION LOCKED
            </h1>
            <p className="text-xs text-gray-500 font-sans leading-relaxed px-4 mt-1">
              Leaderboard and score aggregates are currently encrypted under master organizer lock. The results transmission channel will open instantly upon admin broadcast announcement.
            </p>
          </div>

          <div className="w-full bg-cyber-bg-darker/60 border border-cyber-red/15 p-4 font-mono text-[10px] text-gray-400 text-left flex flex-col gap-1">
            <span className="text-cyber-red font-bold uppercase">📟 TELEMETRY SEC-STATUS:</span>
            <span>⚡ CHANNEL: SCORESPHERE-RESULTS-FEED-8443</span>
            <span>⚡ ENCRYPTION_MODE: CYCLONE-AES-GCM-256</span>
            <span>⚡ REALTIME LINK: {realtimeStatus === "connected" ? "WEBSOCKET ACTIVE" : realtimeStatus === "connecting" ? "ESTABLISHING..." : "DISCONNECTED"}</span>
          </div>

          <div className="flex gap-4 w-full mt-2 justify-center">


            <CyberButton
              variant="magenta"
              size="sm"
              onClick={fetchLeaderboard}
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
    <div className="min-h-screen flex flex-col pb-16 relative">
      {/* Background neon glows */}
      <div className="absolute w-[400px] h-[400px] bg-cyber-cyan/5 rounded-full blur-[120px] top-0 left-[10%] pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] bg-cyber-magenta/5 rounded-full blur-[120px] bottom-0 right-[10%] pointer-events-none" />

      {/* Leaderboard Header */}
      <header className="border-b border-cyber-cyan/15 bg-cyber-bg-darker/90 backdrop-blur-md sticky top-0 z-35">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-cyber-magenta/10 text-cyber-magenta border border-cyber-magenta/20">
              <Trophy className="w-5 h-5 text-cyber-magenta text-glow-magenta animate-pulse" />
            </span>
            <div>
              <h1 className="font-orbitron font-extrabold text-lg text-white tracking-widest text-glow-magenta uppercase">
                SCORESPHERE CHAMPIONS LIST
              </h1>
              <span className="font-mono text-[9px] text-cyber-magenta tracking-widest uppercase block mt-0.5">
                {realtimeStatus === "connected" ? "🔴 LIVE" : "⏳ SYNCING"} SCORE BROADCAST IN EFFECT
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <CyberButton
              variant="magenta"
              size="sm"
              onClick={fetchLeaderboard}
              disabled={refreshing}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> SYNC DATA
            </CyberButton>


          </div>
        </div>
      </header>

      {/* Main Leaderboard Grid */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 w-full mt-10 flex-grow flex flex-col gap-6">
        {leaderboard.length === 0 ? (
          <div className="cyber-glass border border-cyber-cyan/15 p-12 text-center flex flex-col items-center justify-center gap-4">
            <Cpu className="w-8 h-8 text-cyber-cyan animate-spin" />
            <p className="font-orbitron text-xs text-gray-400 uppercase tracking-widest">
              TABULATING TRANSMITTED DATA NODES...
            </p>
          </div>
        ) : (
          <div className="flex flex-col w-full">
            {/* ========================================================= */}
            {/* THE HYPE PODIUM (TOP 3)                                   */}
            {/* ========================================================= */}
            {leaderboard.length > 0 && (
              <div className="flex flex-col md:flex-row justify-center items-end gap-6 mb-16 mt-12 px-2 md:px-12 min-h-[300px]">
                
                {/* 2ND PLACE (Left side, drops in at 1.5s) */}
                {leaderboard[1] && (
                  <motion.div 
                    initial={{ opacity: 0, y: 150 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.5, type: "spring", bounce: 0.4 }}
                    className="w-full md:w-1/3 flex flex-col items-center order-2 md:order-1"
                  >
                    <div className="cyber-glass border border-cyber-cyan/40 bg-cyber-cyan/10 w-full p-6 text-center shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col items-center relative overflow-hidden rounded-t-xl md:h-[220px] justify-end hover:-translate-y-2 transition-transform cursor-pointer" onClick={() => toggleTeam(leaderboard[1].teamId)}>
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-cyber-cyan shadow-[0_0_10px_#06b6d4]" />
                      <div className="w-14 h-14 rounded-full bg-cyber-cyan/20 border-2 border-cyber-cyan text-cyber-cyan flex items-center justify-center font-orbitron font-extrabold text-2xl mb-4 shadow-[0_0_20px_#06b6d4]">2</div>
                      <h3 className="font-orbitron font-bold text-lg text-white uppercase w-full break-words leading-tight text-glow-cyan">{leaderboard[1].teamName}</h3>
                      <p className="font-mono text-sm text-cyber-cyan mt-3 font-bold bg-black/50 px-3 py-1 rounded-full">{leaderboard[1].averageScore} PTS</p>
                      
                      {/* Expanded scores for 2nd place */}
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

                {/* 1ST PLACE (Center, drops in at 3.0s) */}
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
                    
                    <div className="cyber-glass border-2 border-cyber-yellow/60 bg-cyber-yellow/15 w-full p-8 text-center shadow-[0_0_50px_rgba(234,179,8,0.3)] flex flex-col items-center relative overflow-hidden rounded-t-xl md:h-[280px] justify-end transform md:scale-110 hover:-translate-y-2 transition-transform cursor-pointer" onClick={() => toggleTeam(leaderboard[0].teamId)}>
                      <div className="absolute top-0 left-0 w-full h-2 bg-cyber-yellow shadow-[0_0_20px_#eab308]" />
                      <div className="absolute inset-0 bg-cyber-yellow/10 pointer-events-none animate-pulse" />
                      
                      <div className="w-20 h-20 rounded-full bg-cyber-yellow/20 border-2 border-cyber-yellow text-cyber-yellow flex items-center justify-center font-orbitron font-extrabold text-4xl mb-4 shadow-[0_0_30px_#eab308] relative z-10">1</div>
                      <h3 className="font-orbitron font-black text-2xl text-white uppercase w-full break-words leading-tight text-glow-yellow relative z-10">{leaderboard[0].teamName}</h3>
                      <p className="font-mono text-base text-cyber-yellow mt-3 font-extrabold bg-black/60 px-4 py-1.5 rounded-full relative z-10">{leaderboard[0].averageScore} PTS</p>

                      {/* Expanded scores for 1st place */}
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

                {/* 3RD PLACE (Right side, drops in first at 0.2s) */}
                {leaderboard[2] && (
                  <motion.div 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, type: "spring", bounce: 0.4 }}
                    className="w-full md:w-1/3 flex flex-col items-center order-3 md:order-3"
                  >
                    <div className="cyber-glass border border-cyber-magenta/40 bg-cyber-magenta/10 w-full p-6 text-center shadow-[0_0_30px_rgba(217,70,239,0.15)] flex flex-col items-center relative overflow-hidden rounded-t-xl md:h-[180px] justify-end hover:-translate-y-2 transition-transform cursor-pointer" onClick={() => toggleTeam(leaderboard[2].teamId)}>
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-cyber-magenta shadow-[0_0_10px_#d946ef]" />
                      <div className="w-12 h-12 rounded-full bg-cyber-magenta/20 border-2 border-cyber-magenta text-cyber-magenta flex items-center justify-center font-orbitron font-extrabold text-xl mb-4 shadow-[0_0_20px_#d946ef]">3</div>
                      <h3 className="font-orbitron font-bold text-base text-white uppercase w-full break-words leading-tight text-glow-magenta">{leaderboard[2].teamName}</h3>
                      <p className="font-mono text-sm text-cyber-magenta mt-3 font-bold bg-black/50 px-3 py-1 rounded-full">{leaderboard[2].averageScore} PTS</p>

                      {/* Expanded scores for 3rd place */}
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
            {/* THE REST OF THE LEADERBOARD (HONORABLE MENTIONS)          */}
            {/* ========================================================= */}
            {leaderboard.length > 3 && (
              <div className="flex flex-col gap-4 mt-8">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 5.0, duration: 1 }}
                  className="flex items-center gap-4 w-full mb-6"
                >
                  <div className="h-px bg-gray-800 flex-grow" />
                  <span className="font-orbitron text-xs font-bold text-gray-500 uppercase tracking-widest px-4">
                    HONORABLE MENTIONS
                  </span>
                  <div className="h-px bg-gray-800 flex-grow" />
                </motion.div>

                {leaderboard.slice(3).map((entry, idx) => {
                  const actualRank = idx + 4;
                  const isExpanded = !!expandedTeams[entry.teamId];
                  const revealDelay = 5.5 + (idx * 0.15); // Reveal after podium sequence completes
                  
                  return (
                    <motion.div 
                      key={entry.teamId}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, delay: revealDelay }}
                      className="cyber-glass border border-gray-800 bg-gray-900/30 transition-all duration-300 flex flex-col relative overflow-hidden"
                    >
                      <div 
                        className="p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => toggleTeam(entry.teamId)}
                      >
                        {/* Left segment: Rank & Info */}
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 flex items-center justify-center font-orbitron font-extrabold text-lg border clip-cyber border-gray-700 text-gray-400 bg-gray-800/30">
                            #{actualRank}
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <h3 className="font-orbitron font-bold text-base text-gray-200 tracking-wide uppercase">
                              {entry.teamName}
                            </h3>
                            <div className="flex items-center gap-3 font-mono text-[10px] text-gray-500">
                              <span className="flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-gray-600" /> EVALUATIONS: {entry.judgeSubmissions.length}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right segment: Scores & Visualizer */}
                        <div className="flex items-center gap-6 shrink-0 justify-between sm:justify-end">
                          <div className="text-right">
                            <span className="font-mono text-[9px] text-gray-500 uppercase tracking-widest block">
                              AVERAGE
                            </span>
                            <span className="font-orbitron font-extrabold text-2xl tracking-widest flex items-center justify-end gap-2 text-gray-300">
                              {entry.averageScore}
                              {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content: Judge Breakdown */}
                      {isExpanded && (
                        <div className="px-5 pb-5 pt-2 border-t border-gray-800 bg-black/40">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                            {entry.judgeSubmissions.map((sub, i) => (
                              <div key={i} className="bg-gray-900/50 border border-gray-800 p-2 flex justify-between items-center">
                                <span className="font-orbitron text-[10px] text-gray-400 uppercase truncate pr-2">
                                  {sub.judgeName}
                                </span>
                                <span className="font-mono text-xs font-bold text-gray-300">
                                  {sub.totalScore}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Cybernetic telemetry footer */}
      <footer className="mt-auto pt-10 text-center font-mono text-[9px] text-gray-600 uppercase tracking-widest">
        LIVE BROADCAST BROAD-SHIELD AUDITED • SYNC FREQ: 5.8GHZ
      </footer>
    </div>
  );
}
