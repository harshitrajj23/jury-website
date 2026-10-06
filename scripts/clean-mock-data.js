require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const sql = neon(connectionString);

async function cleanMockData() {
  console.log("🧹 Cleaning ONLY Mock / Demo Data (Preserving Real Hackathon Data)...");

  // Delete mock scores
  const scoreRes = await sql`
    DELETE FROM "Score" 
    WHERE id LIKE 'mock_%' 
       OR "teamId" LIKE 'mock_%' 
       OR "judgeId" LIKE 'mock_%' 
       OR "eventId" LIKE 'mock_%';
  `;

  // Delete mock teams
  const teamRes = await sql`
    DELETE FROM "Team" 
    WHERE id LIKE 'mock_%' 
       OR "eventId" LIKE 'mock_%';
  `;

  // Delete mock users
  const userRes = await sql`
    DELETE FROM "User" 
    WHERE id LIKE 'mock_%' 
       OR "eventId" LIKE 'mock_%';
  `;

  // Delete mock criteria
  const critRes = await sql`
    DELETE FROM "Criteria" 
    WHERE id LIKE 'mock_%' 
       OR "eventId" LIKE 'mock_%';
  `;

  // Delete mock events
  const evtRes = await sql`
    DELETE FROM "Event" 
    WHERE id LIKE 'mock_%';
  `;

  console.log("✅ Cleanup Complete! Real hackathon data remains untouched.");

  const counts = await sql`
    SELECT 
      (SELECT COUNT(*) FROM "Event") as events,
      (SELECT COUNT(*) FROM "User") as users,
      (SELECT COUNT(*) FROM "Team") as teams,
      (SELECT COUNT(*) FROM "Criteria") as criteria,
      (SELECT COUNT(*) FROM "Score") as scores
  `;
  console.log("📊 Preserved Production Database Status:", counts[0]);
}

cleanMockData().catch((err) => {
  console.error("❌ Failed to clean mock data:", err);
  process.exit(1);
});
