require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function audit() {
  console.log("=== PHASE 2: DATABASE TRUTH AUDIT (READ-ONLY) ===");
  
  // 1. Events
  const events = await sql`SELECT id, name, status, active, "createdAt" FROM "Event" ORDER BY "createdAt" ASC;`;
  console.log(`\nEVENTS (${events.length}):`);
  events.forEach(e => console.log(`  - [${e.id}] "${e.name}" | Status: ${e.status} | Active: ${e.active}`));

  // 2. Criteria
  const criteria = await sql`SELECT id, name, description, "maxScore", weight, "orderIndex", active, "eventId", "createdAt" FROM "Criteria" ORDER BY "eventId", "orderIndex" ASC;`;
  console.log(`\nCRITERIA (${criteria.length}):`);
  criteria.forEach(c => console.log(`  - [${c.id}] "${c.name}" | Max: ${c.maxScore} | Weight: ${c.weight} | Order: ${c.orderIndex} | Active: ${c.active} | EventId: "${c.eventId}"`));

  // 3. Teams
  const teams = await sql`SELECT id, "teamName", "projectName", "teamCode", "tableNumber", "eventId" FROM "Team" ORDER BY "eventId", "teamName" ASC;`;
  console.log(`\nTEAMS (${teams.length}):`);
  teams.forEach(t => console.log(`  - [${t.id}] "${t.teamName}" | Code: ${t.teamCode} | EventId: "${t.eventId}"`));

  // 4. Users / Judges (safe - no passwords)
  const users = await sql`SELECT id, name, email, role, completed, "eventId" FROM "User" ORDER BY role DESC, name ASC;`;
  console.log(`\nUSERS / JUDGES (${users.length}):`);
  users.forEach(u => console.log(`  - [${u.id}] "${u.name}" (${u.email}) | Role: ${u.role} | EventId: "${u.eventId}"`));

  // 5. Scores
  const scores = await sql`SELECT id, "judgeId", "teamId", "criteriaId", score, "eventId" FROM "Score";`;
  console.log(`\nSCORES (${scores.length}):`);
  scores.forEach(s => console.log(`  - [${s.id}] Judge: ${s.judgeId} | Team: ${s.teamId} | Crit: ${s.criteriaId} | Score: ${s.score} | EventId: "${s.eventId}"`));

  // 6. Settings
  const settings = await sql`SELECT * FROM "Settings";`;
  console.log(`\nSETTINGS (${settings.length}):`, settings);

  // 7. Audit Logs for Criteria
  const critLogs = await sql`SELECT action, details, "eventId", "createdAt" FROM "AuditLog" WHERE action ILIKE '%CRIT%' ORDER BY "createdAt" DESC LIMIT 10;`;
  console.log(`\nCRITERIA AUDIT LOGS (${critLogs.length}):`, critLogs);

  console.log("\n=== AUDIT COMPLETE ===");
}

audit().catch(console.error);
