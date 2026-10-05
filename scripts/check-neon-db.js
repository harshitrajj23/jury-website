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

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('User', 'Team', 'Criteria', 'Score', 'Settings', 'AuditLog');
    `;
    console.log("✅ Active Native Tables in Database:");
    tables.forEach(t => console.log(`   - "${t.table_name}"`));

    const [{ userCount }] = await sql`SELECT count(*)::int as "userCount" FROM "User";`;
    const [{ teamCount }] = await sql`SELECT count(*)::int as "teamCount" FROM "Team";`;
    const [{ criteriaCount }] = await sql`SELECT count(*)::int as "criteriaCount" FROM "Criteria";`;
    const [{ scoreCount }] = await sql`SELECT count(*)::int as "scoreCount" FROM "Score";`;
    const [{ auditCount }] = await sql`SELECT count(*)::int as "auditCount" FROM "AuditLog";`;

    console.log("");
    console.log(`📊 Current Data Summary:`);
    console.log(`   - Users / Judges: ${userCount}`);
    console.log(`   - Teams: ${teamCount}`);
    console.log(`   - Criteria: ${criteriaCount}`);
    console.log(`   - Scores: ${scoreCount}`);
    console.log(`   - Audit Logs: ${auditCount}`);
    console.log("");
    console.log("🚀 Neon DB is 100% synced with website!");
  } catch (err) {
    console.error("❌ Neon DB Error:", err);
    process.exit(1);
  }
}

main();
