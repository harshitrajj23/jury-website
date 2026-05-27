"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, AlertTriangle } from "lucide-react";
import CyberButton from "./CyberButton";

interface TimerProps {
  duration?: number; // duration in seconds
}

export default function Timer({ duration = 480 }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync timeLeft when duration updates from the database
  useEffect(() => {
    Promise.resolve().then(() => {
      setTimeLeft(duration);
      setIsRunning(false);
    });
    if (timerRef.current) clearInterval(timerRef.current);
  }, [duration]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (isRunning) {
        Promise.resolve().then(() => setIsRunning(false));
      }
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timeLeft]);

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(duration);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isLowTime = timeLeft <= 60; // less than or equal to 1 minute left

  return (
    <div className="cyber-glass p-4 border border-cyber-cyan/20 w-full max-w-sm flex flex-col items-center">
      {/* Module Title */}
      <div className="w-full flex items-center justify-between border-b border-cyber-cyan/15 pb-2 mb-4">
        <span className="font-orbitron text-xs font-bold tracking-widest text-cyber-cyan/70 uppercase">
          ⏲️ PRESENTATION_MONITOR
        </span>
        <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-cyber-green animate-pulse" : "bg-cyber-yellow"}`} />
      </div>

      {/* Timer Display */}
      <div className="relative py-2 flex flex-col items-center">
        <div
          className={`
            font-orbitron text-5xl font-extrabold tracking-widest select-none transition-all duration-300
            ${isLowTime ? "text-cyber-red text-glow-red animate-pulse" : "text-cyber-cyan text-glow-cyan"}
          `}
        >
          {formatTime(timeLeft)}
        </div>
        
        {isLowTime && timeLeft > 0 && (
          <div className="flex items-center gap-1.5 text-cyber-red font-mono text-[9px] uppercase tracking-wider mt-2 animate-bounce">
            <AlertTriangle className="w-3.5 h-3.5" /> CRITICAL: UNDER_1_MIN
          </div>
        )}
        
        {timeLeft === 0 && (
          <div className="flex items-center gap-1.5 text-cyber-red font-mono text-[10px] uppercase tracking-wider mt-2 animate-pulse font-bold">
            ⚠️ TERMINAL_TIMEOUT: TIME LIMIT EXCEEDED
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3 mt-4 w-full justify-center">
        <CyberButton
          variant={isRunning ? "yellow" : "cyan"}
          size="sm"
          onClick={toggleTimer}
          className="flex items-center gap-1.5 min-w-[90px]"
        >
          {isRunning ? (
            <>
              <Pause className="w-3 h-3" /> PAUSE
            </>
          ) : (
            <>
              <Play className="w-3 h-3 animate-pulse" /> START
            </>
          )}
        </CyberButton>

        <CyberButton
          variant="red"
          size="sm"
          onClick={resetTimer}
          className="flex items-center gap-1.5 min-w-[90px]"
        >
          <RotateCcw className="w-3 h-3" /> RESET
        </CyberButton>
      </div>

      {/* Rules Prompt */}
      <div className="w-full text-center border-t border-cyber-cyan/10 pt-2 mt-4">
        <p className="text-[10px] text-gray-500 font-mono">
          EVALUATING CYCLE: {Math.round(duration / 60)} MINUTES MAXIMUM
        </p>
      </div>
    </div>
  );
}
