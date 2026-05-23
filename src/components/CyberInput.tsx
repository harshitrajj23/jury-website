import React from "react";

interface CyberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  variant?: "cyan" | "magenta";
}

export default function CyberInput({
  label,
  error,
  variant = "cyan",
  className = "",
  type = "text",
  ...props
}: CyberInputProps) {
  const glowBorder =
    variant === "cyan"
      ? "focus:border-cyber-cyan focus:shadow-[0_0_12px_rgba(6,182,212,0.3)]"
      : "focus:border-cyber-magenta focus:shadow-[0_0_12px_rgba(217,70,239,0.3)]";

  const labelGlow =
    variant === "cyan"
      ? "text-cyber-cyan text-glow-cyan"
      : "text-cyber-magenta text-glow-magenta";

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && (
        <label className={`font-orbitron text-xs font-semibold tracking-widest uppercase ${labelGlow}`}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={type}
          className={`
            w-full bg-cyber-bg-darker/80 text-gray-100 font-mono text-sm px-4 py-2.5 
            border rounded-none outline-none transition-all duration-300
            ${error ? "border-cyber-red/60 focus:border-cyber-red focus:shadow-[0_0_12px_rgba(244,63,94,0.3)]" : "border-gray-800 focus:border-gray-500"} 
            ${glowBorder}
            clip-cyber-sm
          `}
          {...props}
        />
        {/* Subtle Tech-Corner Highlight */}
        <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-white/20 pointer-events-none" />
      </div>
      {error && (
        <span className="text-[10px] font-mono text-cyber-red tracking-wide uppercase mt-0.5 animate-pulse">
          ⚡ ERR_TRANSMISSION: {error}
        </span>
      )}
    </div>
  );
}
