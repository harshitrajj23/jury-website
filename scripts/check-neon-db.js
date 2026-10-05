require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
  console.error("❌ Missing DATABASE_URL in .env");
  console.error("Please add: DATABASE_URL=\"postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require\"");
  process.exit(1);
}

async function main() {
  console.log("🔍 Checking Neon Database connection...");
  console.log(`📡 URL host: ${connectionString.split("@")[1] || "configured"}`);
  console.log("");

  const sql = neon(connectionString);

  try {
    // 1. Check connection
    const [{ now }] = await sql`SELECT NOW() as now;`;
    console.log(`✅ Connected to Neon Postgres successfully at ${now}!`);
    console.log("");

    // 2. Initialize tables if needed
    console.log("🛠️ Initializing tables in Neon DB...");
    await sql`
      CREATE TABLE IF NOT EXISTS pals_judges (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        designation TEXT NOT NULL,
        password TEXT
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS pals_teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS pals_config (
        id TEXT PRIMARY KEY,
        "announceResults" BOOLEAN DEFAULT FALSE,
        "criteriaList" JSONB DEFAULT '[]'::jsonb,
        "timerDuration" INTEGER DEFAULT 480
      );
    `;

    await sql`
      INSERT INTO pals_config (id, "announceResults", "criteriaList", "timerDuration")
      VALUES ('main', FALSE, '[]'::jsonb, 480)
      ON CONFLICT (id) DO NOTHING;
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS pals_scores (
        "teamId" TEXT NOT NULL,
        "judgeId" TEXT NOT NULL,
        scores JSONB NOT NULL DEFAULT '{}'::jsonb,
        "totalScore" NUMERIC NOT NULL DEFAULT 0,
        "submittedAt" TEXT NOT NULL,
        "judgeSignOff" JSONB DEFAULT '{}'::jsonb,
        PRIMARY KEY ("teamId", "judgeId")
      );
    `;

    console.log("✅ All tables verified & ready:");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'pals_%';
    `;
    tables.forEach(t => console.log(`   - ${t.table_name}`));

    const [{ judgeCount }] = await sql`SELECT count(*)::int as "judgeCount" FROM pals_judges;`;
    const [{ teamCount }] = await sql`SELECT count(*)::int as "teamCount" FROM pals_teams;`;
    const [{ scoreCount }] = await sql`SELECT count(*)::int as "scoreCount" FROM pals_scores;`;
    console.log("");
    console.log(`📊 Current Data Summary: ${judgeCount} judges, ${teamCount} teams, ${scoreCount} scores.`);
    console.log("🚀 Neon DB is 100% ready for production!");
  } catch (err) {
    console.error("❌ Neon DB Error:", err);
    process.exit(1);
  }
}

main();
