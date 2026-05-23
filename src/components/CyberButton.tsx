import React from "react";

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "cyan" | "magenta" | "green" | "red" | "yellow";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  children: React.ReactNode;
}

export default function CyberButton({
  variant = "cyan",
  size = "md",
  fullWidth = false,
  children,
  className = "",
  ...props
}: CyberButtonProps) {
  const baseStyle = "relative font-orbitron font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
  
  const sizeStyles = {
    sm: "px-4 py-1.5 text-xs clip-cyber-sm",
    md: "px-6 py-2.5 text-sm clip-cyber",
    lg: "px-8 py-3.5 text-base clip-cyber",
  };

  const variantStyles = {
    cyan: "bg-cyber-cyan/10 hover:bg-cyber-cyan/35 text-cyber-cyan border border-cyber-cyan/40 hover:border-cyber-cyan hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]",
    magenta: "bg-cyber-magenta/10 hover:bg-cyber-magenta/35 text-cyber-magenta border border-cyber-magenta/40 hover:border-cyber-magenta hover:shadow-[0_0_15px_rgba(217,70,239,0.4)]",
    green: "bg-cyber-green/10 hover:bg-cyber-green/35 text-cyber-green border border-cyber-green/40 hover:border-cyber-green hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]",
    red: "bg-cyber-red/10 hover:bg-cyber-red/35 text-cyber-red border border-cyber-red/40 hover:border-cyber-red hover:shadow-[0_0_15px_rgba(244,63,94,0.4)]",
    yellow: "bg-cyber-yellow/10 hover:bg-cyber-yellow/35 text-cyber-yellow border border-cyber-yellow/40 hover:border-cyber-yellow hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]",
  };

  return (
    <button
      className={`
        ${baseStyle} 
        ${sizeStyles[size]} 
        ${variantStyles[variant]} 
        ${fullWidth ? "w-full" : ""} 
        ${className}
      `}
      {...props}
    >
      {/* Visual Tech-Accents inside the button */}
      <span className="absolute top-0 left-0 w-1 h-1 bg-white/50" />
      <span className="absolute bottom-0 right-0 w-1 h-1 bg-white/50" />
      
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}
