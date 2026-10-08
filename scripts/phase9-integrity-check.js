require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function runIntegrityCheck() {
  console.log("=== PHASE 9: DATABASE INTEGRITY AUDIT ===");

  // 1. Events
  const events = await sql`SELECT id, name, status, active FROM "Event";`;
  const eventIds = new Set(events.map(e => e.id));
  console.log(`Active Events in DB (${events.length}):`, events.map(e => `${e.id} ("${e.name}")`));

  // 2. Teams referencing missing events
  const teams = await sql`SELECT id, "teamName", "eventId" FROM "Team";`;
  const orphanedTeams = teams.filter(t => !eventIds.has(t.eventId));
  console.log(`Teams (${teams.length}): Orphaned (referencing missing event): ${orphanedTeams.length}`);
  if (orphanedTeams.length > 0) {
    console.log("  Orphaned teams:", orphanedTeams);
  }

  // 3. Criteria referencing missing events
  const criteria = await sql`SELECT id, name, active, "eventId" FROM "Criteria";`;
  const orphanedCriteria = criteria.filter(c => !eventIds.has(c.eventId) && c.eventId !== 'default_event');
  console.log(`Criteria (${criteria.length}): Orphaned: ${orphanedCriteria.length}`);
  if (orphanedCriteria.length > 0) {
    console.log("  Orphaned criteria:", orphanedCriteria);
  }

  // 4. Users referencing missing events
  const users = await sql`SELECT id, name, role, "eventId" FROM "User";`;
  const userEventIssues = [];
  for (const u of users) {
    if (u.role === 'admin') continue;
    const assigned = (u.eventId || '').split(',').map(s => s.trim()).filter(Boolean);
    const missing = assigned.filter(id => !eventIds.has(id));
    if (missing.length > 0) {
      userEventIssues.push({ user: u.name, id: u.id, missingEvents: missing });
    }
  }
  console.log(`Users (${users.length}): With missing event references: ${userEventIssues.length}`);
  if (userEventIssues.length > 0) {
    console.log("  User issues:", userEventIssues);
  }

  // 5. Scores referencing missing teams, criteria, judges, or events
  const scores = await sql`SELECT id, "judgeId", "teamId", "criteriaId", "eventId", score FROM "Score";`;
  const teamIdSet = new Set(teams.map(t => t.id));
  const critIdSet = new Set(criteria.map(c => c.id));
  const userIdSet = new Set(users.map(u => u.id));

  const orphanedScores = scores.filter(s => 
    !teamIdSet.has(s.teamId) || 
    !critIdSet.has(s.criteriaId) || 
    !userIdSet.has(s.judgeId) || 
    !eventIds.has(s.eventId)
  );
  console.log(`Scores (${scores.length}): Orphaned: ${orphanedScores.length}`);
  if (orphanedScores.length > 0) {
    console.log("  Orphaned scores:", orphanedScores);
  }

  // 6. Duplicate scores
  const scoreKeys = new Set();
  const duplicateScores = [];
  for (const s of scores) {
    const key = `${s.judgeId}_${s.teamId}_${s.criteriaId}`;
    if (scoreKeys.has(key)) {
      duplicateScores.push(s);
    } else {
      scoreKeys.add(key);
    }
  }
  console.log(`Duplicate scores (judge + team + criteria): ${duplicateScores.length}`);

  // 7. Duplicate criteria within same event
  const critEventKeys = new Set();
  const duplicateCriteria = [];
  for (const c of criteria) {
    const key = `${c.eventId}_${c.name.trim().toLowerCase()}`;
    if (critEventKeys.has(key)) {
      duplicateCriteria.push(c);
    } else {
      critEventKeys.add(key);
    }
  }
  console.log(`Duplicate criteria within same event: ${duplicateCriteria.length}`);

  console.log("=== INTEGRITY CHECK COMPLETE ===");
}

runIntegrityCheck().catch(console.error);
