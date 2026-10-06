const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function testSubmission() {
  const criteria = await sql`SELECT id FROM "Criteria" WHERE active = true`;
  const judge = (await sql`SELECT id FROM "User" LIMIT 1`)[0];
  const team = (await sql`SELECT id FROM "Team" LIMIT 1`)[0];
  if (!judge || !team || criteria.length === 0) return console.log('No data');

  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    const criteriaIds = criteria.map(c => c.id);
    const scores = criteria.map(() => Math.floor(Math.random() * 10) + 1);
    const now = new Date().toISOString();
    
    await sql`
      INSERT INTO "Score" ("id", "judgeId", "teamId", "criteriaId", "score", "createdAt", "updatedAt")
      SELECT 
        'bench_' || ${judge.id} || '_' || ${team.id} || '_' || c_id,
        ${judge.id},
        ${team.id},
        c_id,
        s_val,
        ${now}::timestamp,
        ${now}::timestamp
      FROM UNNEST(
        ${criteriaIds}::text[],
        ${scores}::int[]
      ) AS t(c_id, s_val)
      ON CONFLICT ("judgeId", "teamId", "criteriaId")
      DO UPDATE SET
        "score" = EXCLUDED."score",
        "updatedAt" = EXCLUDED."updatedAt";
    `;
    console.log(`DB Operation ${i + 1}: ${Date.now() - t0}ms`);
  }
}

testSubmission().catch(console.error);
