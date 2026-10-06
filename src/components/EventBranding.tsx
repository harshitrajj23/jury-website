"use client";

import React, { useState } from "react";
import { Award, ShieldCheck, Sparkles, Building2 } from "lucide-react";
import { EventItem } from "@/lib/types";

interface EventBrandingProps {
  event?: EventItem | null;
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  align?: "left" | "center";
  themeColor?: "cyan" | "magenta" | "green";
}

export default function EventBranding({
  event,
  size = "md",
  showSubtitle = true,
  align = "left",
  themeColor = "cyan",
}: EventBrandingProps) {
  const [logoError, setLogoError] = useState(false);
  const [orgLogoError, setOrgLogoError] = useState(false);

  const hasEventLogo = Boolean(event?.logo && event.logo.trim() && !logoError);
  const hasOrgLogo = Boolean(event?.organizerLogo && event.organizerLogo.trim() && !orgLogoError);

  const colorClasses = {
    cyan: {
      glow: "text-glow-cyan text-cyber-cyan",
      border: "border-cyber-cyan/30",
      bg: "bg-cyber-cyan/10",
      icon: "text-cyber-cyan",
      subtext: "text-cyber-cyan/80",
    },
    magenta: {
      glow: "text-glow-magenta text-cyber-magenta",
      border: "border-cyber-magenta/30",
      bg: "bg-cyber-magenta/10",
      icon: "text-cyber-magenta",
      subtext: "text-cyber-magenta/80",
    },
    green: {
      glow: "text-glow-green text-cyber-green",
      border: "border-cyber-green/30",
      bg: "bg-cyber-green/10",
      icon: "text-cyber-green",
      subtext: "text-cyber-green/80",
    },
  }[themeColor];

  const logoHeight = size === "sm" ? "h-6 max-w-[90px]" : size === "lg" ? "h-11 max-w-[150px]" : "h-8 max-w-[120px]";
  const iconSize = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-7 h-7" : "w-5 h-5";
  const titleSize = size === "sm" ? "text-sm sm:text-base" : size === "lg" ? "text-xl sm:text-2xl" : "text-base sm:text-lg";

  return (
    <div className={`flex items-center gap-3 min-w-0 ${align === "center" ? "justify-center text-center flex-col sm:flex-row" : "justify-start text-left"}`}>
      {/* Visual Branding Section: Event Logo, Organizer Logo, or Clean Generic Placeholder */}
      <div className="flex items-center gap-2 shrink-0">
        {hasEventLogo && (
          <div className={`p-1.5 bg-black/40 border ${colorClasses.border} flex items-center justify-center transition-all shadow-sm`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event!.logo}
              alt={event?.name || "Event Logo"}
              className={`${logoHeight} object-contain`}
              onError={() => setLogoError(true)}
            />
          </div>
        )}

        {hasOrgLogo && (
          <div className={`p-1.5 bg-black/40 border border-gray-700/60 flex items-center justify-center transition-all shadow-sm`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event!.organizerLogo}
              alt={event?.organizer || "Organizer Logo"}
              className={`${logoHeight} object-contain`}
              onError={() => setOrgLogoError(true)}
            />
          </div>
        )}

        {!hasEventLogo && !hasOrgLogo && (
          <div className={`p-2 ${colorClasses.bg} border ${colorClasses.border} flex items-center justify-center shadow-[0_0_10px_rgba(0,240,255,0.15)]`}>
            <Award className={`${iconSize} ${colorClasses.icon} animate-pulse`} />
          </div>
        )}
      </div>

      {/* Typography Section: Dynamic Event Title, Organizer, Subtitle */}
      <div className={`min-w-0 ${align === "center" ? "text-center" : "text-left"}`}>
        <h2 className={`font-orbitron font-extrabold ${titleSize} text-white tracking-widest uppercase truncate ${colorClasses.glow}`}>
          {event?.name || "EVALUATION PLATFORM"}
        </h2>

        {showSubtitle && (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap justify-start font-mono text-[10px]">
            {event?.organizer && (
              <span className="text-gray-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5 text-gray-400 inline" />
                {event.organizer}
              </span>
            )}
            {event?.organizer && (event?.subtitle || event?.date) && (
              <span className="text-gray-500">•</span>
            )}
            {event?.subtitle && (
              <span className="text-gray-400 tracking-wide uppercase truncate">
                {event.subtitle}
              </span>
            )}
            {event?.date && (
              <>
                <span className="text-gray-500">•</span>
                <span className={colorClasses.subtext}>{event.date}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
