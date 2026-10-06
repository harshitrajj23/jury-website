require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const sql = neon(connectionString);

async function migrateEvents() {
  console.log("⚡ Starting Multi-Event Database Schema Migration...");

  // 1. Create Event table
  await sql`
    CREATE TABLE IF NOT EXISTS "Event" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      organizer TEXT NOT NULL DEFAULT '',
      logo TEXT NOT NULL DEFAULT '',
      "timerDuration" INTEGER NOT NULL DEFAULT 300,
      "judgingOpen" BOOLEAN NOT NULL DEFAULT true,
      "leaderboardUnlocked" BOOLEAN NOT NULL DEFAULT false,
      "finaleReady" BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;
  console.log("✅ Table 'Event' verified/created.");

  // 2. Add eventId column to Team, Criteria, Score, User
  await sql`ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "eventId" TEXT NOT NULL DEFAULT 'default_event';`;
  await sql`ALTER TABLE "Criteria" ADD COLUMN IF NOT EXISTS "eventId" TEXT NOT NULL DEFAULT 'default_event';`;
  await sql`ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "eventId" TEXT NOT NULL DEFAULT 'default_event';`;
  await sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "eventId" TEXT NOT NULL DEFAULT 'default_event';`;
  console.log("✅ 'eventId' column added to Team, Criteria, Score, User.");

  // 3. Insert or update default event
  await sql`
    INSERT INTO "Event" (id, name, subtitle, organizer, logo, "timerDuration", "judgingOpen", "leaderboardUnlocked", "finaleReady", active, "createdAt", "updatedAt")
    VALUES ('default_event', 'PALS Hackathon 2026', 'BMSIT Innovation Challenge', 'PALS Consortium', '/pals-logo.svg', 300, true, false, false, true, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      subtitle = EXCLUDED.subtitle,
      organizer = EXCLUDED.organizer,
      logo = EXCLUDED.logo;
  `;
  console.log("✅ Default event 'default_event' (PALS Hackathon 2026) ensured.");

  // 4. Update existing rows where eventId is null
  await sql`UPDATE "Team" SET "eventId" = 'default_event' WHERE "eventId" IS NULL;`;
  await sql`UPDATE "Criteria" SET "eventId" = 'default_event' WHERE "eventId" IS NULL;`;
  await sql`UPDATE "Score" SET "eventId" = 'default_event' WHERE "eventId" IS NULL;`;
  await sql`UPDATE "User" SET "eventId" = 'default_event' WHERE "eventId" IS NULL;`;

  // 5. Create performance indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_team_event ON "Team" ("eventId");`;
  await sql`CREATE INDEX IF NOT EXISTS idx_score_event ON "Score" ("eventId");`;
  await sql`CREATE INDEX IF NOT EXISTS idx_criteria_event ON "Criteria" ("eventId");`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_event ON "User" ("eventId");`;
  console.log("✅ Indexes on 'eventId' verified/created.");

  const events = await sql`SELECT id, name, logo, "timerDuration" FROM "Event";`;
  console.log("📊 Active Events in DB:", events);

  console.log("🚀 Multi-Event Migration Complete!");
}

migrateEvents().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
