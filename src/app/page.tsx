"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, User, Radio, Cpu, BadgeCheck, Briefcase } from "lucide-react";
import { getJudges, addJudge, initDatabase } from "@/lib/db";
import CyberInput from "@/components/CyberInput";
import CyberButton from "@/components/CyberButton";

export default function JudgeAuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(true);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");

  useEffect(() => {
    initDatabase();
    const timer = setTimeout(() => setBooting(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setFullName("");
    setDesignation("");
    setError("");
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const judges = await getJudges();
      const usernameVal = username.trim().toLowerCase();

      if (isLogin) {
        // --- LOGIN ---
        const matched = judges.find(
          (j) => j.username.toLowerCase() === usernameVal && j.password === password
        );
        if (!matched) {
          setError("INVALID CREDENTIALS. ACCESS DENIED.");
          setLoading(false);
          return;
        }
        sessionStorage.setItem("judge_session", JSON.stringify({
          id: matched.id,
          username: matched.username,
          name: matched.name,
          designation: matched.designation,
        }));
        router.push("/dashboard");

      } else {
        // --- REGISTER ---
        if (!fullName.trim() || !designation.trim() || !usernameVal || !password) {
          setError("ALL FIELDS ARE REQUIRED FOR REGISTRATION.");
          setLoading(false);
          return;
        }
        const exists = judges.find((j) => j.username.toLowerCase() === usernameVal);
        if (exists) {
          setError("USERNAME ALREADY IN USE. CHOOSE ANOTHER.");
          setLoading(false);
          return;
        }
        const newJudge = await addJudge({
          username: usernameVal,
          name: fullName.trim(),
          designation: designation.trim(),
          password,
        });
        sessionStorage.setItem("judge_session", JSON.stringify({
          id: newJudge.id,
          username: newJudge.username,
          name: newJudge.name,
          designation: newJudge.designation,
        }));
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err?.message ? `ERROR: ${err.message.toUpperCase()}` : "TRANSMISSION ERROR: DATABASE DISCONNECTED.");
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
            <span className="font-orbitron font-bold tracking-widest text-sm">SCORESPHERE_INITIALIZE</span>
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
      {/* Background neon blobs */}
      <div className="absolute w-[300px] h-[300px] bg-cyber-cyan/5 rounded-full blur-[100px] top-[10%] left-[20%] pointer-events-none" />
      <div className="absolute w-[300px] h-[300px] bg-cyber-magenta/5 rounded-full blur-[100px] bottom-[15%] right-[20%] pointer-events-none" />

      {/* Main Terminal Frame */}
      <div className="w-full max-w-md cyber-glass p-8 border border-cyber-cyan/25 relative flex flex-col gap-6 z-10">
        {/* Corner accents */}
        <span className="absolute top-0 left-0 w-2 h-2 bg-cyber-cyan" />
        <span className="absolute bottom-0 right-0 w-2 h-2 bg-cyber-cyan" />
        <span className="absolute top-0 right-0 w-2 h-2 bg-cyber-cyan/30" />
        <span className="absolute bottom-0 left-0 w-2 h-2 bg-cyber-cyan/30" />

        {/* Portal Header */}
        <div className="flex flex-col gap-1 text-center border-b border-cyber-cyan/15 pb-4">
          <div className="flex justify-center items-center gap-2 mb-1.5">
            <Radio className="w-5 h-5 text-cyber-cyan animate-pulse" />
            <span className="font-mono text-xs text-cyber-cyan/80 tracking-widest font-bold uppercase">
              SCORESPHERE HACKATHON
            </span>
          </div>
          <h1 className="font-orbitron font-extrabold text-2xl text-white tracking-widest text-glow-cyan">
            JURY PORTAL
          </h1>
          <p className="font-sans text-[10px] text-gray-500 tracking-wider uppercase mt-1">
            BMS Institute of Technology &amp; Management, Bengaluru
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex w-full border border-cyber-cyan/30 font-orbitron text-xs">
          <button
            type="button"
            className={`flex-1 py-2.5 transition-all duration-300 tracking-widest ${
              isLogin
                ? "bg-cyber-cyan text-black font-bold"
                : "bg-transparent text-gray-400 hover:bg-cyber-cyan/10"
            }`}
            onClick={() => { setIsLogin(true); resetForm(); }}
          >
            AUTHORIZE
          </button>
          <button
            type="button"
            className={`flex-1 py-2.5 transition-all duration-300 tracking-widest ${
              !isLogin
                ? "bg-cyber-cyan text-black font-bold"
                : "bg-transparent text-gray-400 hover:bg-cyber-cyan/10"
            }`}
            onClick={() => { setIsLogin(false); resetForm(); }}
          >
            REGISTER
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="flex flex-col gap-4">

          {/* Register-only fields */}
          {!isLogin && (
            <>
              <div className="relative">
                <BadgeCheck className="absolute right-3 bottom-3 w-4 h-4 text-cyber-cyan/50" />
                <CyberInput
                  label="Full Name"
                  placeholder="e.g. Dr. Sarah Connor"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="relative">
                <Briefcase className="absolute right-3 bottom-3 w-4 h-4 text-cyber-cyan/50" />
                <CyberInput
                  label="Designation / Institution"
                  placeholder="e.g. Professor, CSE Dept"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </>
          )}

          {/* Shared fields */}
          <div className="relative">
            <User className="absolute right-3 bottom-3 w-4 h-4 text-cyber-cyan/50" />
            <CyberInput
              label="Judge ID / Username"
              placeholder="e.g. sarah_c"
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
            <CyberButton type="submit" variant="cyan" fullWidth disabled={loading}>
              {loading
                ? "PROCESSING..."
                : isLogin
                ? "ESTABLISH CONNECTION"
                : "INITIALIZE JURIST NODE"}
            </CyberButton>
            <p className="text-[9px] text-center text-gray-500 font-mono">
              {isLogin
                ? "NEW JUDGE? SWITCH TO REGISTER TAB ABOVE"
                : "ALREADY REGISTERED? SWITCH TO AUTHORIZE TAB ABOVE"}
            </p>
          </div>
        </form>
      </div>

      <footer className="mt-8 text-center text-[10px] text-gray-600 font-mono uppercase tracking-widest relative z-10">
        SYSTEM SHIELD AUDIT ACTIVE • BMSIT&M © 2026
      </footer>
    </div>
  );
}
