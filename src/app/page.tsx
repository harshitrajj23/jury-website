"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, User, Radio, Cpu, BadgeCheck } from "lucide-react";
import { initDatabase, verifyUserLogin, getEvents } from "@/lib/db";
import { EventItem } from "@/lib/types";
import CyberInput from "@/components/CyberInput";
import CyberButton from "@/components/CyberButton";

export default function JudgeAuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(true);
  const [activeEvent, setActiveEvent] = useState<EventItem | null>(null);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    initDatabase();
    getEvents().then((evs) => {
      if (evs && evs.length > 0) {
        setActiveEvent(evs[0]);
      }
    }).catch(() => {});
    const timer = setTimeout(() => setBooting(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const usernameVal = username.trim().toLowerCase();
      const authRes = await verifyUserLogin(usernameVal, password);
      if (!authRes.success || !authRes.data) {
        setError(authRes.error || "INVALID CREDENTIALS. ACCESS DENIED.");
        setLoading(false);
        return;
      }
      const matched = authRes.data;
      sessionStorage.setItem("judge_session", JSON.stringify({
        id: matched.id,
        username: matched.username,
        name: matched.name,
        designation: matched.designation,
        eventId: matched.eventId || "default_event",
      }));
      router.push("/dashboard");
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
            <span className="font-orbitron font-bold tracking-widest text-sm">JURY_PLATFORM_INITIALIZE</span>
          </div>
          <p className="text-xs">⚡ SECURE CONNECTION PROTOCOL LOADED...</p>
          <p className="text-xs">⚡ SYNCING MULTI-EVENT STORAGE NODES...</p>
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
      {/* Background neon blobs & Ambient Banner */}
      <div className="absolute w-[300px] h-[300px] bg-cyber-cyan/5 rounded-full blur-[100px] top-[10%] left-[20%] pointer-events-none" />
      <div className="absolute w-[300px] h-[300px] bg-cyber-magenta/5 rounded-full blur-[100px] bottom-[15%] right-[20%] pointer-events-none" />
      {activeEvent?.banner && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10 filter blur-[2px] pointer-events-none"
          style={{ backgroundImage: `url(${activeEvent.banner})` }}
        />
      )}

      {/* Main Terminal Frame */}
      <div className="w-full max-w-md cyber-glass p-6 sm:p-8 border border-cyber-cyan/25 relative flex flex-col gap-6 z-10 shadow-[0_0_40px_rgba(6,182,212,0.1)]">
        {/* Corner accents */}
        <span className="absolute top-0 left-0 w-2 h-2 bg-cyber-cyan" />
        <span className="absolute bottom-0 right-0 w-2 h-2 bg-cyber-cyan" />
        <span className="absolute top-0 right-0 w-2 h-2 bg-cyber-cyan/30" />
        <span className="absolute bottom-0 left-0 w-2 h-2 bg-cyber-cyan/30" />

        {/* Dynamic Portal Header */}
        <div className="flex flex-col gap-2 text-center border-b border-cyber-cyan/15 pb-4">
          <div className="flex justify-center items-center gap-2">
            <Radio className="w-4 h-4 text-cyber-cyan animate-pulse" />
            <span className="font-mono text-xs text-cyber-cyan/90 tracking-widest font-bold uppercase truncate max-w-full">
              SECURE JURY ACCESS
            </span>
          </div>

          <div className="flex justify-center items-center gap-3 my-1">
            {activeEvent?.logo ? (
              <div className="p-2 bg-black/60 border border-cyber-cyan/40 shadow-[0_0_15px_rgba(0,240,255,0.2)] max-w-[140px] max-h-16 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeEvent.logo}
                  alt={activeEvent.name || "Event Logo"}
                  className="max-h-12 max-w-full object-contain"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              </div>
            ) : (
              <div className="p-2.5 bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan shadow-[0_0_12px_rgba(0,240,255,0.2)]">
                <BadgeCheck className="w-6 h-6 animate-pulse" />
              </div>
            )}
          </div>

          <h1 className="font-orbitron font-extrabold text-xl sm:text-2xl text-white tracking-widest text-glow-cyan uppercase">
            {activeEvent?.name ? activeEvent.name : "JURY PORTAL"}
          </h1>

          <p className="font-sans text-[11px] text-gray-400 tracking-wider uppercase">
            {activeEvent?.organizer ? `Organized by ${activeEvent.organizer}` : "Authorized Evaluator Terminal • Multi-Event Platform"}
          </p>
        </div>

        {/* Security Notice */}
        <div className="bg-cyber-bg-darker/80 border border-cyber-cyan/20 p-2.5 text-center">
          <p className="text-[10px] font-mono text-cyber-cyan">
            🔒 Enter your admin-assigned evaluator credentials to access your evaluation workspace.
          </p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="flex flex-col gap-4">
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
            <CyberButton type="submit" variant="cyan" fullWidth disabled={loading}>
              {loading ? "AUTHENTICATING..." : "ESTABLISH CONNECTION"}
            </CyberButton>
            <p className="text-[9px] text-center text-gray-500 font-mono">
              EVENT ASSIGNMENT IS CONTROLLED BY PLATFORM ADMINS
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
