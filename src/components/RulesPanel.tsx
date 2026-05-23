import React from "react";
import { AlertCircle, Clock, ShieldAlert, Award } from "lucide-react";

export default function RulesPanel() {
  const rules = [
    {
      icon: <Clock className="w-5 h-5 text-cyber-cyan" />,
      title: "8-MINUTE TIMER LIMIT",
      desc: "Each team is allocated exactly 8 minutes total for presentation and Q&A. Use the timer monitor to track duration.",
    },
    {
      icon: <ShieldAlert className="w-5 h-5 text-cyber-magenta" />,
      title: "INDEPENDENT EVALUATION",
      desc: "Perform evaluations strictly independently. Do not consult or discuss scoring with fellow judges before final locks.",
    },
    {
      icon: <AlertCircle className="w-5 h-5 text-cyber-yellow" />,
      title: "CONFLICTS OF INTEREST",
      desc: "If you have a prior relationship, mentoring record, or other conflict with a team, declare it instantly to the lead organizer.",
    },
    {
      icon: <Award className="w-5 h-5 text-cyber-green" />,
      title: "SCORE FINALITY & LOCKS",
      desc: "Double-check your evaluations before sign-off. Once locked, scores are encrypted and cannot be modified by the judge.",
    },
  ];

  return (
    <div className="cyber-glass p-5 border border-cyber-cyan/15 w-full flex flex-col gap-4">
      {/* Title */}
      <div className="flex items-center gap-2 border-b border-cyber-cyan/20 pb-3">
        <span className="p-1.5 bg-cyber-cyan/15 text-cyber-cyan rounded-none border border-cyber-cyan/30">
          <AlertCircle className="w-4 h-4 animate-pulse" />
        </span>
        <div>
          <h3 className="font-orbitron font-bold text-sm text-cyber-cyan text-glow-cyan tracking-wider">
            JUDGING COMPLIANCE MODULE
          </h3>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
            PROTOCOL SEC-ID: 77-BMSITM
          </p>
        </div>
      </div>

      {/* Rules list */}
      <div className="flex flex-col gap-4">
        {rules.map((rule, idx) => (
          <div key={idx} className="flex gap-3 items-start border-l-2 border-cyber-cyan/20 pl-3 py-1 hover:border-cyber-cyan/50 hover:bg-cyber-cyan/5 transition-all duration-300">
            <div className="mt-0.5">{rule.icon}</div>
            <div className="flex flex-col gap-0.5">
              <h4 className="font-orbitron text-xs font-bold text-gray-200 tracking-wide uppercase">
                {rule.title}
              </h4>
              <p className="text-xs text-gray-400 font-sans leading-relaxed">
                {rule.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Warning Alert */}
      <div className="bg-cyber-red/10 border border-cyber-red/35 p-3 flex flex-col gap-1.5 mt-2">
        <div className="flex items-center gap-1.5 text-cyber-red font-orbitron text-xs font-bold uppercase tracking-wider">
          🚨 SECURITY CONFIDENTIALITY MANDATE
        </div>
        <p className="text-[11px] text-gray-400 leading-normal font-sans">
          All team profiles, prototypes, codes, and scores are subject to active confidentiality agreements. Unauthorized distribution of leaderboard snapshots is strictly audited.
        </p>
      </div>
    </div>
  );
}
