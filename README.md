# Jury Evaluation Platform 🚀

A modern real-time jury evaluation platform for hackathons, innovation challenges, startup pitch competitions, project expos, and any event requiring structured judging and live result management.

This platform provides secure judge scoring, real-time admin monitoring, automated leaderboard calculation, and a cinematic finale reveal experience.

---

## ✨ Features

### Judge Dashboard
- Secure authentication
- Personalized judge dashboard
- Assigned team/project evaluations
- Criteria-based scoring
- Weighted score calculation
- Optional comments per criterion
- Draft save functionality
- Final submission lock
- Progress tracking
- Evaluation timer

---

### Admin Dashboard
- Real-time mission control dashboard
- Monitor judge progress
- View team evaluation completion
- Hidden live leaderboard
- Open / Close judging
- Lock / Unlock leaderboard
- Arm finale mode
- Launch finale reveal
- Export CSV reports
- Export PDF reports
- Reset evaluations
- Audit log monitoring

---

### Leaderboard & Finale
- Live leaderboard calculations
- Weighted ranking system
- Tie-breaker support
- Animated leaderboard reveal
- Top 3 podium showcase
- Score counter animations
- Confetti celebration
- Winner spotlight sequence

---

## 🌍 Use Cases

Perfect for:

- Hackathons
- Startup pitch events
- Innovation challenges
- College project expos
- Coding competitions
- Product demo days
- Business plan competitions
- Design showcases
- Research project evaluations
- Any jury-based competition

---

## 🛠 Tech Stack

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
- PostgreSQL (Neon Database)
- Prisma ORM

### Authentication
- NextAuth / Auth.js
- bcrypt password hashing

### Optional Realtime
- Socket.io
- Pusher
- Supabase Realtime

---

## 📂 Project Structure

```bash
app/
├── admin/
│   ├── dashboard/
│   ├── leaderboard/
│   └── finale/
│
├── judge/
│   ├── dashboard/
│   └── evaluation/[teamId]/
│
├── login/

components/
├── admin/
├── judge/
├── leaderboard/
├── animations/
├── ui/

lib/
├── prisma.ts
├── auth.ts
├── scoring.ts
├── utils.ts

prisma/
└── schema.prisma
```

---

## ⚙ Installation

Clone repository:

```bash
git clone https://github.com/yourusername/jury-evaluation-platform.git
cd jury-evaluation-platform
```

Install dependencies:

```bash
npm install
```

---

## 🔐 Environment Variables

Create `.env.local`

```env
DATABASE_URL=your_neon_database_url
NEXTAUTH_SECRET=your_generated_secret
NEXTAUTH_URL=http://localhost:3000
```

Generate secret:

```bash
openssl rand -base64 32
```

Example:

```env
DATABASE_URL=postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
```

---

## 🗄 Database Setup

Generate Prisma client:

```bash
npx prisma generate
```

Run migrations:

```bash
npx prisma migrate dev --name init
```

Seed database:

```bash
npx prisma db seed
```

---

## ▶ Run Project

Development:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

Open:

```txt
http://localhost:3000
```

---

## 📊 Evaluation System

Criteria are fully configurable.

Example scoring metrics:

- Innovation & Creativity
- Technical Implementation
- Problem Solving
- User Experience
- Feasibility & Scalability
- Presentation Skills
- Effort & Skill
- Time Management
- Learning & Adaptability
- Impact

Each criterion supports:
- custom max score
- weighting
- comments
- ordering

---

## 👥 User Roles

### Admin
Can:
- manage event lifecycle
- monitor judges
- control leaderboard visibility
- launch finale
- export reports
- reset scores
- configure settings

---

### Judge
Can:
- login securely
- evaluate assigned teams
- save drafts
- submit final evaluations

Cannot:
- modify submitted scores
- access admin controls
- access hidden leaderboard

---

## 🧮 Scoring Logic

Weighted scoring:

```ts
finalScore = score * criteria.weight
```

Leaderboard:

```ts
teamScore = sum(all submitted weighted scores)
```

Supports:
- average scoring
- tie-breakers
- ranking normalization

---

## 📥 CSV Import

Supported format:

```csv
team_name,project_name,table,members
```

Example:

```csv
Code Titans,AI Health Assistant,1,"Member A; Member B; Member C"
TechNova,Smart Traffic Optimizer,2,"Member A; Member B"
```

---

## 🔒 Security

Security features:

- role-based authentication
- protected routes
- bcrypt password hashing
- secure session management
- duplicate submission prevention
- audit logging
- admin-only controls

---

## 📝 Audit Logs

Tracked actions:

- LOGIN
- LOGOUT
- SUBMIT_SCORES
- UPDATE_SCORE
- LOCK_LEADERBOARD
- UNLOCK_LEADERBOARD
- OPEN_EVALUATION
- CLOSE_EVALUATION
- FORCE_RESET
- FINALE_READY

---

## 🚀 Future Enhancements

- QR code evaluation access
- mobile judge dashboard
- live realtime websocket sync
- public leaderboard mode
- multi-event support
- email notifications
- certificate generation
- AI scoring analytics

---

## 📄 License

MIT License

---

## 💡 Built For

Modern competitive evaluation systems with premium real-time judging experiences.
