"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, User, Radio, Cpu } from "lucide-react";
import { getJudges, initDatabase } from "@/lib/db";
import CyberInput from "@/components/CyberInput";
import CyberButton from "@/components/CyberButton";

export default function JudgeLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  // Initialize DB on Mount
  useEffect(() => {
    initDatabase();
    // Simulate terminal boot sequence
    const timer = setTimeout(() => {
      setBooting(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill all authorization fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const judges = await getJudges();
      let matchedJudge = judges.find(
        (j) => j.username.toLowerCase() === username.trim().toLowerCase()
      );

      if (!matchedJudge) {
        // Dynamic login fallback: automatically register new judge since the user wants to login with any credentials
        const usernameVal = username.trim();
        const cleanName = usernameVal.includes("@")
          ? usernameVal.split("@")[0].charAt(0).toUpperCase() + usernameVal.split("@")[0].slice(1)
          : usernameVal.charAt(0).toUpperCase() + usernameVal.slice(1);

        const { addJudge } = await import("@/lib/db");
        matchedJudge = await addJudge({
          username: usernameVal.toLowerCase(),
          name: `Judge ${cleanName}`,
          designation: "Guest Jurist",
          password: password,
        });
      }

      // Authenticated! Store in sessionStorage
      sessionStorage.setItem("judge_session", JSON.stringify({
        id: matchedJudge.id,
        username: matchedJudge.username,
        name: matchedJudge.name,
        designation: matchedJudge.designation,
      }));
      
      router.push("/dashboard");
    } catch {
      setError("TRANSMISSION ERROR: DATABASE DISCONNECTED.");
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-cyber-bg flex flex-col justify-center items-center font-mono text-cyber-cyan p-4">
        <div className="flex flex-col gap-2 max-w-md w-full border border-cyber-cyan/35 p-6 bg-cyber-bg-darker relative">
          <div className="absolute top-0 right-0 w-2 h-2 bg-cyber-cyan animate-ping" />
          <div className="flex items-center gap-2 border-b border-cyber-cyan/20 pb-3 mb-4">
            <Cpu className="w-5 h-5 animate-spin" />
            <span className="font-orbitron font-bold tracking-widest text-sm">PALS_SYSTEM_INITIALIZE</span>
          </div>
          <p className="text-xs">⚡ SECURE CONNECTION PROTOCOL LOADED...</p>
          <p className="text-xs">⚡ SYNCING STORAGE NODES...</p>
          <p className="text-xs">⚡ MOUNTING CRYO-DB ENGINES...</p>
          <div className="w-full bg-gray-950 h-1.5 mt-4 relative overflow-hidden border border-cyber-cyan/25">
            <div className="bg-cyber-cyan h-full absolute left-0 top-0 w-2/3 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background neon effect */}
      <div className="absolute w-[300px] h-[300px] bg-cyber-cyan/5 rounded-full blur-[100px] top-[10%] left-[20%] pointer-events-none" />
      <div className="absolute w-[300px] h-[300px] bg-cyber-magenta/5 rounded-full blur-[100px] bottom-[15%] right-[20%] pointer-events-none" />

      {/* Main Terminal Frame */}
      <div className="w-full max-w-md cyber-glass p-8 border border-cyber-cyan/25 relative flex flex-col gap-6">
        {/* Glow corners */}
        <span className="absolute top-0 left-0 w-2 h-2 bg-cyber-cyan" />
        <span className="absolute bottom-0 right-0 w-2 h-2 bg-cyber-cyan" />
        <span className="absolute top-0 right-0 w-2 h-2 bg-cyber-cyan/30" />
        <span className="absolute bottom-0 left-0 w-2 h-2 bg-cyber-cyan/30" />

        {/* Portal Header */}
        <div className="flex flex-col gap-1 text-center border-b border-cyber-cyan/15 pb-4">
          <div className="flex justify-center items-center gap-2 mb-1.5">
            <Radio className="w-5 h-5 text-cyber-cyan animate-pulse" />
            <span className="font-mono text-xs text-cyber-cyan/80 tracking-widest font-bold uppercase">
              PALS - BMSIT&M HACKATHON
            </span>
          </div>
          <h1 className="font-orbitron font-extrabold text-2xl text-white tracking-widest text-glow-cyan">
            JURY PORTAL
          </h1>
          <p className="font-sans text-[10px] text-gray-500 tracking-wider uppercase mt-1">
            BMS Institute of Technology & Management, Bengaluru
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="relative">
            <User className="absolute right-3 bottom-3 w-4 h-4 text-cyber-cyan/50" />
            <CyberInput
              label="Judge ID / Username"
              placeholder="e.g. judge1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="relative">
            <KeyRound className="absolute right-3 bottom-3 w-4 h-4 text-cyber-cyan/50" />
            <CyberInput
              label="Security Access Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="bg-cyber-red/10 border border-cyber-red/30 px-3.5 py-2.5 font-mono text-xs text-cyber-red flex flex-col">
              <span className="font-bold">⚠️ PROTOCOL_ALERT:</span>
              <p className="text-[11px] leading-relaxed mt-0.5">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 mt-2">
            <CyberButton
              type="submit"
              variant="cyan"
              fullWidth
              disabled={loading}
            >
              {loading ? "AUTHORIZING ACCESS..." : "ESTABLISH CONNECTION"}
            </CyberButton>
            
            <p className="text-[9px] text-center text-gray-500 font-mono">
              SECURE SYNC TERMINAL PORT: 8443
            </p>
          </div>
        </form>
      </div>

      {/* Aesthetic Footer */}
      <footer className="mt-8 text-center text-[10px] text-gray-600 font-mono uppercase tracking-widest">
        SYSTEM SHIELD AUDIT ACTIVE • BMSIT&M © 2026
      </footer>
    </div>
  );
}
