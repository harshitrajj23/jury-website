"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Trophy, 
  Lock, 
  Radio, 
  ArrowLeft, 
  RefreshCw, 
  Cpu, 
  Gamepad2, 
  UserCheck
} from "lucide-react";
import { getLeaderboard, getConfig, initDatabase, LeaderboardEntry } from "@/lib/db";
import CyberButton from "@/components/CyberButton";

export default function LeaderboardPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [announced, setAnnounced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initDatabase();
    fetchLeaderboard();
  }, []);

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
            <span>⚡ SYNC STATUS: STANDBY_PENDING_BROADCAST_TRIGGER</span>
          </div>

          <div className="flex gap-4 w-full mt-2 justify-center">
            {hasJudgeSession ? (
              <CyberButton
                variant="cyan"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> BACK TO DECK
              </CyberButton>
            ) : (
              <CyberButton
                variant="cyan"
                size="sm"
                onClick={() => router.push("/")}
                className="flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> JURY ACCESS
              </CyberButton>
            )}

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
                🔴 LIVE SCORE BROADCAST IN EFFECT
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

            {hasJudgeSession ? (
              <CyberButton
                variant="cyan"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> BACK TO DECK
              </CyberButton>
            ) : (
              <CyberButton
                variant="cyan"
                size="sm"
                onClick={() => router.push("/")}
                className="flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> JURY LOGIN
              </CyberButton>
            )}
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
          <div className="flex flex-col gap-4">
            {leaderboard.map((entry, idx) => {
              const isFirst = entry.rank === 1;
              const isSecond = entry.rank === 2;
              const isThird = entry.rank === 3;
              
              const rankColor = isFirst 
                ? "border-cyber-yellow/40 text-cyber-yellow bg-cyber-yellow/10" 
                : isSecond 
                  ? "border-cyber-cyan/40 text-cyber-cyan bg-cyber-cyan/10" 
                  : isThird 
                    ? "border-cyber-magenta/40 text-cyber-magenta bg-cyber-magenta/10"
                    : "border-gray-800 text-gray-400 bg-gray-900/30";

              const cardGlow = isFirst 
                ? "shadow-[0_0_15px_rgba(234,179,8,0.1)] border-cyber-yellow/30" 
                : isSecond 
                  ? "shadow-[0_0_12px_rgba(6,182,212,0.1)] border-cyber-cyan/20" 
                  : isThird 
                    ? "shadow-[0_0_12px_rgba(217,70,239,0.1)] border-cyber-magenta/20" 
                    : "border-cyber-cyan/10";

              return (
                <div 
                  key={entry.teamId}
                  className={`cyber-glass border p-5 transition-all duration-300 flex flex-col sm:flex-row justify-between sm:items-center gap-4 relative overflow-hidden hover:-translate-y-0.5 ${cardGlow}`}
                >
                  {/* Decorative neon tags */}
                  {isFirst && <span className="absolute top-0 right-0 w-8 h-8 bg-cyber-yellow/20 clip-cyber-sm border-b border-l border-cyber-yellow/40" />}

                  {/* Left segment: Rank & Info */}
                  <div className="flex items-center gap-4">
                    {/* Rank Badge */}
                    <div className={`w-12 h-12 flex items-center justify-center font-orbitron font-extrabold text-lg border clip-cyber ${rankColor}`}>
                      #{entry.rank}
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <h3 className="font-orbitron font-bold text-base text-white tracking-wide uppercase">
                        {entry.teamName}
                      </h3>
                      <div className="flex items-center gap-3 font-mono text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-cyber-cyan" /> EVALUATIONS: {entry.judgeSubmissions.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right segment: Scores & Visualizer */}
                  <div className="flex items-center gap-6 shrink-0 justify-between sm:justify-end">
                    {/* Visual Bar chart display */}
                    <div className="hidden md:flex flex-col gap-1 w-32">
                      <div className="flex justify-between font-mono text-[9px] text-gray-500 uppercase">
                        <span>RATING SCALE</span>
                        <span>{entry.averageScore}%</span>
                      </div>
                      <div className="w-full bg-gray-950 h-2 border border-white/5 relative overflow-hidden">
                        <div 
                          className={`h-full absolute left-0 top-0 transition-all duration-500 ${
                            isFirst ? "bg-cyber-yellow" : isSecond ? "bg-cyber-cyan" : "bg-cyber-magenta"
                          }`}
                          style={{ width: `${entry.averageScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-[9px] text-gray-500 uppercase tracking-widest block">
                        CUMULATIVE AVERAGE
                      </span>
                      <span className={`font-orbitron font-extrabold text-2xl tracking-widest ${
                        isFirst ? "text-cyber-yellow text-glow-yellow" : isSecond ? "text-cyber-cyan text-glow-cyan" : "text-cyber-magenta text-glow-magenta"
                      }`}>
                        {entry.averageScore}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
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
