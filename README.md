# Jury Evaluation Platform

A premium real-time evaluation platform built for hackathons, innovation challenges, startup competitions, project expos, demo days, and jury-based events.

The platform enables judges to securely evaluate participants, administrators to monitor progress, and organizers to reveal final rankings through a cinematic animated leaderboard experience.

---

## Features

### Judge Panel
- Secure authentication
- Judge dashboard
- Assigned participant/team evaluation
- Real-time scoring
- Weighted scoring criteria
- Draft save functionality
- Final submission lock
- Progress tracking
- Evaluation comments
- Timer support

---

### Admin Panel
- Mission control dashboard
- Judge progress monitoring
- Team/project evaluation overview
- Hidden live leaderboard
- Open / Close evaluation
- Lock / Unlock leaderboard
- Arm finale mode
- Launch finale reveal
- Export CSV
- Export PDF
- Reset evaluations
- Audit logs

---

### Finale Experience
- Cinematic leaderboard reveal
- Animated ranking transitions
- Score counter animations
- Podium reveal
- Confetti celebration
- Winner announcement screen
- Glitch loading transitions

---

## Use Cases

This platform can be used for:

- Hackathons
- Startup pitch competitions
- College project expos
- Innovation challenges
- Coding contests
- Product demo days
- Business plan competitions
- Design showcases
- Research project evaluations
- Any jury-based event

---

## Tech Stack

### Frontend
- Next.js 14+
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- GSAP
- Lucide React

### Backend
- Next.js API Routes
- PostgreSQL / Neon Database
- Prisma ORM
- NextAuth / Auth.js
- bcrypt

### Optional Realtime
- Socket.io
or
- Pusher
or
- Supabase Realtime

---

## Project Structure

```bash
app/
├── admin/
│   ├── dashboard/
│   ├── leaderboard/
│   └── finale/
│
├── judge/
│   ├── dashboard/
│   └── evaluation/[entityId]/
│
├── login/
│
components/
├── admin/
├── judge/
├── leaderboard/
├── animations/
├── ui/
│
lib/
├── prisma.ts
├── auth.ts
├── scoring.ts
├── utils.ts
│
prisma/
└── schema.prisma
