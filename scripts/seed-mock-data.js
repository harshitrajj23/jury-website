require("dotenv").config();
const { neon } = require("@neondatabase/serverless");
const bcrypt = require("bcryptjs");

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const sql = neon(connectionString);

async function seedMockData() {
  console.log("🌱 Seeding Generic Multi-Event Mock / Demo Data for Testing...");

  const hash = bcrypt.hashSync("123456", 10);

  // 1. Insert 3 Generic Mock Events
  console.log("1️⃣ Creating Generic Mock Events (TechNova, InnovateX, Project Expo)...");
  await sql`
    INSERT INTO "Event" (id, name, subtitle, organizer, logo, "organizerLogo", date, theme, status, "timerDuration", "judgingOpen", "leaderboardUnlocked", "finaleReady", active, "createdAt", "updatedAt")
    VALUES 
      ('mock_evt_technova', 'TechNova Hackathon', 'Annual Collegiate Hackathon', 'Computer Science Club', '', '', '2026-10-15', 'AI & Distributed Systems', 'active', 300, true, true, false, true, NOW(), NOW()),
      ('mock_evt_innovatex', 'InnovateX Challenge', 'Engineering & Robotics Showcase', 'Engineering Society', '', '', '2026-11-20', 'Hardware & Automation', 'active', 420, true, true, false, true, NOW(), NOW()),
      ('mock_evt_projectexpo', 'Project Expo', 'Departmental Capstone Fair', 'EEE Department', '', '', '2026-12-05', 'Sustainable Energy & IoT', 'active', 600, true, false, false, true, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      subtitle = EXCLUDED.subtitle,
      organizer = EXCLUDED.organizer,
      "timerDuration" = EXCLUDED."timerDuration",
      "judgingOpen" = true,
      "leaderboardUnlocked" = EXCLUDED."leaderboardUnlocked";
  `;

  // 2. Insert Teams for Event A (TechNova)
  console.log("2️⃣ Creating Teams for Events...");
  await sql`
    INSERT INTO "Team" (id, "teamName", "projectName", "teamCode", "tableNumber", members, "eventId", "createdAt", "updatedAt")
    VALUES 
      ('mock_tm_technova_1', 'Team Alpha', 'Autonomous Drone Fleet Coordinator', 'TEAM-ALP', 1, '["Alex", "Jordan"]', 'mock_evt_technova', NOW(), NOW()),
      ('mock_tm_technova_2', 'Team Beta', 'Decentralized Identity Vault', 'TEAM-BET', 2, '["Taylor", "Morgan"]', 'mock_evt_technova', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      "teamName" = EXCLUDED."teamName",
      "projectName" = EXCLUDED."projectName",
      "eventId" = EXCLUDED."eventId";
  `;

  // Insert Teams for Event B (InnovateX)
  await sql`
    INSERT INTO "Team" (id, "teamName", "projectName", "teamCode", "tableNumber", members, "eventId", "createdAt", "updatedAt")
    VALUES 
      ('mock_tm_innovatex_1', 'Team Orion', 'Neural Prosthetic Interface', 'TEAM-ORI', 1, '["Casey", "Riley"]', 'mock_evt_innovatex', NOW(), NOW()),
      ('mock_tm_innovatex_2', 'Team Nova', 'Solar Grid Edge Load Balancer', 'TEAM-NOV', 2, '["Sam", "Jamie"]', 'mock_evt_innovatex', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      "teamName" = EXCLUDED."teamName",
      "projectName" = EXCLUDED."projectName",
      "eventId" = EXCLUDED."eventId";
  `;

  // Insert Teams for Event C (Project Expo)
  await sql`
    INSERT INTO "Team" (id, "teamName", "projectName", "teamCode", "tableNumber", members, "eventId", "createdAt", "updatedAt")
    VALUES 
      ('mock_tm_expo_1', 'Project One', 'Smart Agricultural Hydroponics System', 'PROJ-01', 1, '["Avery", "Dakota"]', 'mock_evt_projectexpo', NOW(), NOW()),
      ('mock_tm_expo_2', 'Project Two', 'Ultra-Capacitor Fast Charging Station', 'PROJ-02', 2, '["Quinn", "Skyler"]', 'mock_evt_projectexpo', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      "teamName" = EXCLUDED."teamName",
      "projectName" = EXCLUDED."projectName",
      "eventId" = EXCLUDED."eventId";
  `;

  // 3. Insert Independent Judges for Each Event
  console.log("3️⃣ Creating Scoped Judges for Each Event...");
  await sql`
    INSERT INTO "User" (id, name, email, "passwordHash", role, completed, "eventId", "createdAt", "updatedAt")
    VALUES 
      ('mock_usr_technova_j1', 'Dr. Aris Vance', 'judge_technova_1@jury.test', ${hash}, 'judge', false, 'mock_evt_technova', NOW(), NOW()),
      ('mock_usr_technova_j2', 'Elena Rostova', 'judge_technova_2@jury.test', ${hash}, 'judge', false, 'mock_evt_technova', NOW(), NOW()),
      ('mock_usr_innovatex_j1', 'Prof. Marcus Wright', 'judge_innovatex_1@jury.test', ${hash}, 'judge', false, 'mock_evt_innovatex', NOW(), NOW()),
      ('mock_usr_innovatex_j2', 'Dr. Maya Lin', 'judge_innovatex_2@jury.test', ${hash}, 'judge', false, 'mock_evt_innovatex', NOW(), NOW()),
      ('mock_usr_expo_j1', 'Prof. Daniel Cho', 'judge_expo_1@jury.test', ${hash}, 'judge', false, 'mock_evt_projectexpo', NOW(), NOW()),
      ('mock_usr_expo_j2', 'Sarah Jenkins', 'judge_expo_2@jury.test', ${hash}, 'judge', false, 'mock_evt_projectexpo', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      "eventId" = EXCLUDED."eventId";
  `;

  // 4. Insert Independent Criteria for Each Event
  console.log("4️⃣ Ensuring Independent Criteria for Each Event...");
  const technovaCriteria = [
    { name: "Innovation & Problem Solving", desc: "Originality of technical solution", weight: 0.25 },
    { name: "Technical Execution & Architecture", desc: "Code quality and system robustness", weight: 0.35 },
    { name: "User Experience & Polish", desc: "Intuitive flow and visual design", weight: 0.20 },
    { name: "Pitch & Live Demonstration", desc: "Clarity and live working proof", weight: 0.20 },
  ];

  for (let i = 0; i < technovaCriteria.length; i++) {
    const c = technovaCriteria[i];
    await sql`
      INSERT INTO "Criteria" (id, name, description, "maxScore", weight, "orderIndex", active, "eventId", "createdAt")
      VALUES (${`mock_cr_technova_${i}`}, ${c.name}, ${c.desc}, 10, ${c.weight}, ${i}, true, 'mock_evt_technova', NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, weight = EXCLUDED.weight, "eventId" = EXCLUDED."eventId", active = true;
    `;
  }

  const innovatexCriteria = [
    { name: "Hardware Integration & Circuits", desc: "Robotics and circuit engineering", weight: 0.30 },
    { name: "Real-world Viability & Safety", desc: "Practical implementation feasibility", weight: 0.30 },
    { name: "Scalability & Market Readiness", desc: "Commercialization potential", weight: 0.20 },
    { name: "Demonstration & Q&A Response", desc: "Depth of technical answers", weight: 0.20 },
  ];

  for (let i = 0; i < innovatexCriteria.length; i++) {
    const c = innovatexCriteria[i];
    await sql`
      INSERT INTO "Criteria" (id, name, description, "maxScore", weight, "orderIndex", active, "eventId", "createdAt")
      VALUES (${`mock_cr_innovatex_${i}`}, ${c.name}, ${c.desc}, 10, ${c.weight}, ${i}, true, 'mock_evt_innovatex', NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, weight = EXCLUDED.weight, "eventId" = EXCLUDED."eventId", active = true;
    `;
  }

  const expoCriteria = [
    { name: "Domain Relevance & Need", desc: "Addresses tangible societal/industry need", weight: 0.30 },
    { name: "Engineering Rigor", desc: "Design methodology and validation", weight: 0.40 },
    { name: "Project Documentation & Poster", desc: "Comprehensive documentation", weight: 0.30 },
  ];

  for (let i = 0; i < expoCriteria.length; i++) {
    const c = expoCriteria[i];
    await sql`
      INSERT INTO "Criteria" (id, name, description, "maxScore", weight, "orderIndex", active, "eventId", "createdAt")
      VALUES (${`mock_cr_expo_${i}`}, ${c.name}, ${c.desc}, 10, ${c.weight}, ${i}, true, 'mock_evt_projectexpo', NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, weight = EXCLUDED.weight, "eventId" = EXCLUDED."eventId", active = true;
    `;
  }

  // 5. Sample Scores for Event A & Event B
  console.log("5️⃣ Seeding Sample Evaluation Scores...");
  // Event A: Judge 1 scores Team Alpha
  for (let i = 0; i < technovaCriteria.length; i++) {
    const scId = `mock_sc_technova_t1_j1_${i}`;
    const scoreVal = (i % 2) + 8; // 8, 9
    await sql`
      INSERT INTO "Score" (id, "judgeId", "teamId", "criteriaId", score, comment, "eventId", "createdAt", "updatedAt")
      VALUES (${scId}, 'mock_usr_technova_j1', 'mock_tm_technova_1', ${`mock_cr_technova_${i}`}, ${scoreVal}, 'Excellent prototype execution', 'mock_evt_technova', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, "eventId" = EXCLUDED."eventId";
    `;
  }

  // Event A: Judge 1 scores Team Beta
  for (let i = 0; i < technovaCriteria.length; i++) {
    const scId = `mock_sc_technova_t2_j1_${i}`;
    const scoreVal = (i % 3) + 7; // 7, 8, 9
    await sql`
      INSERT INTO "Score" (id, "judgeId", "teamId", "criteriaId", score, comment, "eventId", "createdAt", "updatedAt")
      VALUES (${scId}, 'mock_usr_technova_j1', 'mock_tm_technova_2', ${`mock_cr_technova_${i}`}, ${scoreVal}, 'Strong technical architecture', 'mock_evt_technova', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, "eventId" = EXCLUDED."eventId";
    `;
  }

  // Event B: Judge 1 scores Team Orion
  for (let i = 0; i < innovatexCriteria.length; i++) {
    const scId = `mock_sc_innovatex_t1_j1_${i}`;
    const scoreVal = (i % 2) + 7; // 7, 8
    await sql`
      INSERT INTO "Score" (id, "judgeId", "teamId", "criteriaId", score, comment, "eventId", "createdAt", "updatedAt")
      VALUES (${scId}, 'mock_usr_innovatex_j1', 'mock_tm_innovatex_1', ${`mock_cr_innovatex_${i}`}, ${scoreVal}, 'Solid hardware integration', 'mock_evt_innovatex', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, "eventId" = EXCLUDED."eventId";
    `;
  }

  console.log("\n✅ Generic Mock Data Successfully Seeded!");
  console.log("   - Event A: 'mock_evt_technova' (TechNova Hackathon) [Computer Science Club]");
  console.log("     Teams: Team Alpha, Team Beta | Judges: 2 | Criteria: 4");
  console.log("   - Event B: 'mock_evt_innovatex' (InnovateX Challenge) [Engineering Society]");
  console.log("     Teams: Team Orion, Team Nova | Judges: 2 | Criteria: 4");
  console.log("   - Event C: 'mock_evt_projectexpo' (Project Expo) [EEE Department]");
  console.log("     Teams: Project One, Project Two | Judges: 2 | Criteria: 3");
  console.log("\n🔑 Test Judge Credentials (Password: 123456):");
  console.log("   Event A: judge_technova_1@jury.test, judge_technova_2@jury.test");
  console.log("   Event B: judge_innovatex_1@jury.test, judge_innovatex_2@jury.test");
  console.log("   Event C: judge_expo_1@jury.test, judge_expo_2@jury.test");
  console.log("   Admin: admin123 (Password for /admin)");
}

seedMockData().catch((err) => {
  console.error("❌ Failed to seed mock data:", err);
  process.exit(1);
});
