require("dotenv").config();
const { neon } = require("@neondatabase/serverless");
const bcrypt = require("bcryptjs");

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const sql = neon(connectionString);

async function seedMockData() {
  console.log("🌱 Seeding Mock / Demo Multi-Event Data for Testing...");

  const hash = bcrypt.hashSync("123456", 10);

  // 1. Insert 2 Mock Events
  console.log("1️⃣ Creating Mock Events...");
  await sql`
    INSERT INTO "Event" (id, name, subtitle, organizer, logo, "timerDuration", "judgingOpen", "leaderboardUnlocked", "finaleReady", active, "createdAt", "updatedAt")
    VALUES 
      ('mock_evt_pals', 'PALS Hackathon 2026', 'BMSIT Innovation Challenge', 'PALS Consortium', '/pals-logo.svg', 300, true, true, false, true, NOW(), NOW()),
      ('mock_evt_ieee', 'IEEE Innovation Challenge', 'Student Branch Flagship 2026', 'IEEE CIS', '/ieee-logo.svg', 420, true, true, false, true, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      subtitle = EXCLUDED.subtitle,
      organizer = EXCLUDED.organizer,
      logo = EXCLUDED.logo,
      "timerDuration" = EXCLUDED."timerDuration",
      "judgingOpen" = true,
      "leaderboardUnlocked" = true;
  `;

  // 2. Insert Teams for Event A (PALS)
  console.log("2️⃣ Creating Teams for Event A & Event B...");
  await sql`
    INSERT INTO "Team" (id, "teamName", "projectName", "teamCode", "tableNumber", members, "eventId", "createdAt", "updatedAt")
    VALUES 
      ('mock_tm_pals_1', 'PALS-A1 NeuroSync AI', 'Brain-Computer Interface for ALS Patients', 'TEAM-PLS1', 1, '["Aarav", "Neha"]', 'mock_evt_pals', NOW(), NOW()),
      ('mock_tm_pals_2', 'PALS-A2 QuantumShift', 'Post-Quantum Handshake Verification', 'TEAM-PLS2', 2, '["Rohan", "Ananya"]', 'mock_evt_pals', NOW(), NOW()),
      ('mock_tm_pals_3', 'PALS-A3 BioGuard Sentinel', 'Edge AI Bio-hazard Detector', 'TEAM-PLS3', 3, '["Vikram", "Sneha"]', 'mock_evt_pals', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      "teamName" = EXCLUDED."teamName",
      "projectName" = EXCLUDED."projectName",
      "eventId" = EXCLUDED."eventId";
  `;

  // Insert Teams for Event B (IEEE)
  await sql`
    INSERT INTO "Team" (id, "teamName", "projectName", "teamCode", "tableNumber", members, "eventId", "createdAt", "updatedAt")
    VALUES 
      ('mock_tm_ieee_1', 'IEEE-B1 CyberPulse Hub', 'Distributed Zero-Trust Security Mesh', 'TEAM-IEE1', 1, '["Karan", "Pooja"]', 'mock_evt_ieee', NOW(), NOW()),
      ('mock_tm_ieee_2', 'IEEE-B2 SolarGrid Dynamic', 'Micro-grid Solar Optimization Engine', 'TEAM-IEE2', 2, '["Siddharth", "Meera"]', 'mock_evt_ieee', NOW(), NOW()),
      ('mock_tm_ieee_3', 'IEEE-B3 AeroVision UAV', 'Autonomous Drone Navigation in GPS-denied Zones', 'TEAM-IEE3', 3, '["Aditya", "Tara"]', 'mock_evt_ieee', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      "teamName" = EXCLUDED."teamName",
      "projectName" = EXCLUDED."projectName",
      "eventId" = EXCLUDED."eventId";
  `;

  // 3. Insert Judges for Event A & Event B
  console.log("3️⃣ Creating Judges for Event A & Event B...");
  await sql`
    INSERT INTO "User" (id, name, email, "passwordHash", role, completed, "eventId", "createdAt", "updatedAt")
    VALUES 
      ('mock_usr_pals_j1', 'Dr. Aris Vance', 'judge_pals_1@pals.test', ${hash}, 'judge', false, 'mock_evt_pals', NOW(), NOW()),
      ('mock_usr_pals_j2', 'Elena Rostova', 'judge_pals_2@pals.test', ${hash}, 'judge', false, 'mock_evt_pals', NOW(), NOW()),
      ('mock_usr_ieee_j1', 'Prof. Marcus Wright', 'judge_ieee_1@ieee.test', ${hash}, 'judge', false, 'mock_evt_ieee', NOW(), NOW()),
      ('mock_usr_ieee_j2', 'Dr. Maya Lin', 'judge_ieee_2@ieee.test', ${hash}, 'judge', false, 'mock_evt_ieee', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      "eventId" = EXCLUDED."eventId";
  `;

  // 4. Criteria for Event A & Event B
  console.log("4️⃣ Ensuring Criteria for Event A & Event B...");
  const baseCriteria = [
    { id: "crit_innov", name: "Innovation & Uniqueness", desc: "Novelty of solution", weight: 0.15 },
    { id: "crit_tech", name: "Technical Feasibility", desc: "Complexity and engineering", weight: 0.15 },
    { id: "crit_uiux", name: "UI & User Experience", desc: "Usability and polish", weight: 0.10 },
    { id: "crit_pres", name: "Presentation & Delivery", desc: "Clarity of pitch", weight: 0.10 },
    { id: "crit_impact", name: "Market / Social Impact", desc: "Viability and reach", weight: 0.15 },
    { id: "crit_scale", name: "Scalability & Architecture", desc: "Robustness under scale", weight: 0.15 },
    { id: "crit_demo", name: "Live Working Prototype", desc: "End-to-end demo execution", weight: 0.20 },
  ];

  for (let i = 0; i < baseCriteria.length; i++) {
    const c = baseCriteria[i];
    await sql`
      INSERT INTO "Criteria" (id, name, description, "maxScore", weight, "orderIndex", active, "eventId", "createdAt")
      VALUES 
        (${`mock_cr_pals_${i}`}, ${c.name}, ${c.desc}, 10, ${c.weight}, ${i}, true, 'mock_evt_pals', NOW()),
        (${`mock_cr_ieee_${i}`}, ${c.name}, ${c.desc}, 10, ${c.weight}, ${i}, true, 'mock_evt_ieee', NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        weight = EXCLUDED.weight,
        "eventId" = EXCLUDED."eventId",
        active = true;
    `;
  }

  // 5. Sample Scores for Event A & Event B
  console.log("5️⃣ Seeding Sample Scores...");
  // Judge 1 scores Team 1 in Event A
  for (let i = 0; i < baseCriteria.length; i++) {
    const scId = `mock_sc_pals_1_j1_${i}`;
    const scoreVal = (i % 3) + 7; // 7, 8, 9
    await sql`
      INSERT INTO "Score" (id, "judgeId", "teamId", "criteriaId", score, comment, "eventId", "createdAt", "updatedAt")
      VALUES (${scId}, 'mock_usr_pals_j1', 'mock_tm_pals_1', ${`mock_cr_pals_${i}`}, ${scoreVal}, 'Strong demonstration', 'mock_evt_pals', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, "eventId" = EXCLUDED."eventId";
    `;
  }

  // Judge 1 scores Team 2 in Event A
  for (let i = 0; i < baseCriteria.length; i++) {
    const scId = `mock_sc_pals_2_j1_${i}`;
    const scoreVal = (i % 2) + 8; // 8, 9
    await sql`
      INSERT INTO "Score" (id, "judgeId", "teamId", "criteriaId", score, comment, "eventId", "createdAt", "updatedAt")
      VALUES (${scId}, 'mock_usr_pals_j1', 'mock_tm_pals_2', ${`mock_cr_pals_${i}`}, ${scoreVal}, 'Impressive engineering', 'mock_evt_pals', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, "eventId" = EXCLUDED."eventId";
    `;
  }

  // Judge 1 scores Team 1 in Event B
  for (let i = 0; i < baseCriteria.length; i++) {
    const scId = `mock_sc_ieee_1_j1_${i}`;
    const scoreVal = (i % 4) + 6; // 6, 7, 8, 9
    await sql`
      INSERT INTO "Score" (id, "judgeId", "teamId", "criteriaId", score, comment, "eventId", "createdAt", "updatedAt")
      VALUES (${scId}, 'mock_usr_ieee_j1', 'mock_tm_ieee_1', ${`mock_cr_ieee_${i}`}, ${scoreVal}, 'Solid architecture', 'mock_evt_ieee', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, "eventId" = EXCLUDED."eventId";
    `;
  }

  // Judge 1 scores Team 2 in Event B
  for (let i = 0; i < baseCriteria.length; i++) {
    const scId = `mock_sc_ieee_2_j1_${i}`;
    const scoreVal = (i % 2) + 7; // 7, 8
    await sql`
      INSERT INTO "Score" (id, "judgeId", "teamId", "criteriaId", score, comment, "eventId", "createdAt", "updatedAt")
      VALUES (${scId}, 'mock_usr_ieee_j1', 'mock_tm_ieee_2', ${`mock_cr_ieee_${i}`}, ${scoreVal}, 'Viable product', 'mock_evt_ieee', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, "eventId" = EXCLUDED."eventId";
    `;
  }

  console.log("\n✅ Mock Data Successfully Seeded!");
  console.log("   - Event A: 'mock_evt_pals' (PALS Hackathon 2026)");
  console.log("     Teams: 3 | Judges: 2 | Criteria: 7 | Scores: 14");
  console.log("   - Event B: 'mock_evt_ieee' (IEEE Innovation Challenge)");
  console.log("     Teams: 3 | Judges: 2 | Criteria: 7 | Scores: 14");
  console.log("\n🔑 Test Judge Credentials (Password for all: 123456):");
  console.log("   Event A: judge_pals_1@pals.test, judge_pals_2@pals.test");
  console.log("   Event B: judge_ieee_1@ieee.test, judge_ieee_2@ieee.test");
  console.log("   Admin: admin123 (Password for /admin)");
}

seedMockData().catch((err) => {
  console.error("❌ Failed to seed mock data:", err);
  process.exit(1);
});
