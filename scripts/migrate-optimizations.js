require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(connectionString);

async function migrate() {
  console.log("🚀 Starting database schema optimization migration...");

  // 1. Add timerDuration to Settings if not exists
  console.log("Adding timerDuration column to Settings...");
  await sql`
    ALTER TABLE "Settings" 
    ADD COLUMN IF NOT EXISTS "timerDuration" INTEGER NOT NULL DEFAULT 480;
  `;

  // 2. Add active column to Criteria if not exists
  console.log("Adding active column to Criteria...");
  await sql`
    ALTER TABLE "Criteria" 
    ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
  `;

  // 3. Ensure CHECK constraint on Score (score between 1 and 10)
  console.log("Ensuring CHECK constraint on Score...");
  try {
    await sql`
      ALTER TABLE "Score"
      DROP CONSTRAINT IF EXISTS "Score_score_range_check";
    `;
    await sql`
      ALTER TABLE "Score"
      ADD CONSTRAINT "Score_score_range_check" CHECK (score >= 1 AND score <= 10);
    `;
  } catch (e) {
    console.warn("Notice regarding Score check constraint:", e.message);
  }

  // 4. Create missing indexes for fast query performance
  console.log("Ensuring database performance indexes...");
  await sql`CREATE INDEX IF NOT EXISTS "idx_score_team_judge" ON "Score" ("teamId", "judgeId");`;
  await sql`CREATE INDEX IF NOT EXISTS "idx_score_judge" ON "Score" ("judgeId");`;
  await sql`CREATE INDEX IF NOT EXISTS "idx_score_team" ON "Score" ("teamId");`;
  await sql`CREATE INDEX IF NOT EXISTS "idx_criteria_order" ON "Criteria" ("orderIndex", "active");`;
  await sql`CREATE INDEX IF NOT EXISTS "idx_team_name" ON "Team" ("teamName");`;
  await sql`CREATE INDEX IF NOT EXISTS "idx_user_email" ON "User" ("email");`;

  console.log("✅ Database schema migration complete!");
}

migrate().catch(console.error);
