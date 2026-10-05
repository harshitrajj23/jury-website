require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

const NEON_URL = process.env.DATABASE_URL;

async function main() {
  console.log("🔍 Checking all tables in Neon DB...");
  const sql = neon(NEON_URL);

  try {
    // 1. Check legacy tables if any data exists
    console.log("--- Checking legacy tables ---");
    let legacyUsers = [];
    let legacyTeams = [];
    let legacyCriteria = [];

    try {
      legacyUsers = await sql`SELECT * FROM "User" LIMIT 50;`;
      console.log(`Found ${legacyUsers.length} in "User" table.`);
    } catch (e) { console.log('("User" table empty or skipped)'); }

    try {
      legacyTeams = await sql`SELECT * FROM "Team" LIMIT 50;`;
      console.log(`Found ${legacyTeams.length} in "Team" table.`);
    } catch (e) { console.log('("Team" table empty or skipped)'); }

    try {
      legacyCriteria = await sql`SELECT * FROM "Criteria" LIMIT 50;`;
      console.log(`Found ${legacyCriteria.length} in "Criteria" table.`);
    } catch (e) { console.log('("Criteria" table empty or skipped)'); }

    // If legacy teams exist, migrate into pals_teams
    if (legacyTeams.length > 0) {
      console.log("🔄 Migrating legacy teams into pals_teams...");
      for (const t of legacyTeams) {
        await sql`
          INSERT INTO pals_teams (id, name)
          VALUES (${t.id || `t_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`}, ${t.name || t.teamName || 'Unnamed Team'})
          ON CONFLICT (id) DO NOTHING;
        `;
      }
    }

    // If legacy users exist, migrate judges into pals_judges
    if (legacyUsers.length > 0) {
      console.log("🔄 Migrating legacy users into pals_judges...");
      for (const u of legacyUsers) {
        if (u.role === 'JUDGE' || u.role === 'judge' || !u.role) {
          const username = (u.email || u.username || u.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
          if (username) {
            await sql`
              INSERT INTO pals_judges (id, username, name, designation, password)
              VALUES (${u.id || `j_${Date.now()}`}, ${username}, ${u.name || username}, ${u.designation || 'Jurist'}, ${u.password || '123456'})
              ON CONFLICT (id) DO NOTHING;
            `;
          }
        }
      }
    }

    // 2. Populate standard criteria into pals_config
    console.log("");
    console.log("⚙️ Populating evaluation criteria into pals_config...");
    const defaultCriteria = [
      { id: "c_1", name: "Innovation & Problem Solving" },
      { id: "c_2", name: "Technical Architecture & Execution" },
      { id: "c_3", name: "User Interface & Experience (UI/UX)" },
      { id: "c_4", name: "Business Viability & Scalability" },
      { id: "c_5", name: "Pitch Presentation & Q&A" }
    ];

    await sql`
      UPDATE pals_config 
      SET "criteriaList" = ${JSON.stringify(defaultCriteria)}::jsonb
      WHERE id = 'main';
    `;

    // 3. Inspect pals_* tables
    const config = await sql`SELECT * FROM pals_config WHERE id = 'main';`;
    const judges = await sql`SELECT * FROM pals_judges;`;
    const teams = await sql`SELECT * FROM pals_teams;`;
    const scores = await sql`SELECT * FROM pals_scores;`;

    console.log("");
    console.log("==========================================");
    console.log("✅ NEON DB IS FULLY CONFIGURED & POPULATED");
    console.log("==========================================");
    console.log(`👨‍⚖️ Judges in pals_judges: ${judges.length}`);
    judges.forEach(j => console.log(`   - [${j.username}] ${j.name} (${j.designation})`));

    console.log(`👥 Teams in pals_teams: ${teams.length}`);
    teams.forEach(t => console.log(`   - ${t.name} (id: ${t.id})`));

    console.log(`⚙️ Criteria in pals_config:`);
    const criteriaList = typeof config[0]?.criteriaList === 'string' ? JSON.parse(config[0].criteriaList) : config[0].criteriaList;
    criteriaList.forEach(c => console.log(`   - [${c.id}] ${c.name}`));

    console.log(`📝 Scores in pals_scores: ${scores.length}`);
    console.log("==========================================");

  } catch (err) {
    console.error("Error:", err);
  }
}

main();
