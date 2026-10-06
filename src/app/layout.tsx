import type { Metadata } from "next";
import { Orbitron, Inter } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jury Evaluation Platform | Multi-Event Judging & Scoring System",
  description: "Generic Multi-Event Jury Evaluation and Realtime Scoring Platform for Competitions, Hackathons, and Project Exhibitions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cyber-bg text-gray-100 cyber-bg-grid relative scanline selection:bg-cyber-magenta selection:text-white">
        {/* Neon Cyber Glow Accents */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyber-cyan/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyber-magenta/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="flex-grow flex flex-col z-10">{children}</div>
      </body>
    </html>
  );
}
