require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

const NEON_URL = process.env.DATABASE_URL;

async function main() {
  console.log("🔄 Verifying and syncing all Neon DB tables & schemas...");

  if (!NEON_URL) {
    console.error("❌ DATABASE_URL missing in .env");
    process.exit(1);
  }

  const neonSql = neon(NEON_URL);

  try {
    // 1. Ensure all tables exist
    console.log("🛠️ 1. Ensuring tables exist...");
    await neonSql`
      CREATE TABLE IF NOT EXISTS pals_judges (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        designation TEXT NOT NULL,
        password TEXT
      );
    `;
    await neonSql`
      CREATE TABLE IF NOT EXISTS pals_teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
    `;
    await neonSql`
      CREATE TABLE IF NOT EXISTS pals_config (
        id TEXT PRIMARY KEY,
        "announceResults" BOOLEAN DEFAULT FALSE,
        "criteriaList" JSONB DEFAULT '[]'::jsonb,
        "timerDuration" INTEGER DEFAULT 480
      );
    `;
    await neonSql`
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
    console.log("✅ Tables verified.");

    // 2. Ensure default criteria exist
    const defaultCriteria = JSON.stringify([
      { id: "c_1", name: "Innovation & Problem Solving" },
      { id: "c_2", name: "Technical Architecture & Execution" },
      { id: "c_3", name: "User Interface & Experience (UI/UX)" },
      { id: "c_4", name: "Business Viability & Scalability" },
      { id: "c_5", name: "Pitch Presentation & Q&A" }
    ]);

    await neonSql`
      INSERT INTO pals_config (id, "announceResults", "criteriaList", "timerDuration")
      VALUES ('main', FALSE, ${defaultCriteria}::jsonb, 480)
      ON CONFLICT (id) DO UPDATE SET 
        "criteriaList" = CASE 
          WHEN pals_config."criteriaList" IS NULL OR pals_config."criteriaList" = '[]'::jsonb 
          THEN ${defaultCriteria}::jsonb 
          ELSE pals_config."criteriaList" 
        END;
    `;
    console.log("✅ Configuration & default criteria verified.");

    // 3. Query all live tables
    const judges = await neonSql`SELECT id, username, name, designation FROM pals_judges ORDER BY name ASC;`;
    const teams = await neonSql`SELECT id, name FROM pals_teams ORDER BY name ASC;`;
    const scores = await neonSql`SELECT "teamId", "judgeId", "totalScore", "submittedAt" FROM pals_scores;`;
    const config = await neonSql`SELECT * FROM pals_config WHERE id = 'main';`;

    console.log("");
    console.log("=========================================");
    console.log("📊 NEON DB CURRENT LIVE DATA SUMMARY");
    console.log("=========================================");
    console.log(`👨‍⚖️ Judges (${judges.length}):`);
    if (judges.length === 0) console.log("   (No judges registered yet)");
    judges.forEach(j => console.log(`   - [${j.username}] ${j.name} (${j.designation})`));

    console.log(`👥 Teams (${teams.length}):`);
    if (teams.length === 0) console.log("   (No teams registered yet)");
    teams.forEach(t => console.log(`   - ${t.name} (id: ${t.id})`));

    console.log(`📝 Scores (${scores.length}):`);
    if (scores.length === 0) console.log("   (No scores submitted yet)");
    scores.forEach(s => console.log(`   - Team: ${s.teamId} | Judge: ${s.judgeId} | Score: ${s.totalScore}`));

    console.log(`⚙️ Config:`);
    const criteriaList = typeof config[0]?.criteriaList === "string" ? JSON.parse(config[0]?.criteriaList) : config[0]?.criteriaList;
    console.log(`   - Results Announced: ${config[0]?.announceResults}`);
    console.log(`   - Timer Duration: ${config[0]?.timerDuration}s`);
    console.log(`   - Criteria count: ${criteriaList?.length || 0}`);
    console.log("=========================================");
    console.log("🎉 NEON DB IS FULLY SYNCED AND READY!");

  } catch (err) {
    console.error("❌ Sync Error:", err);
  }
}

main();
