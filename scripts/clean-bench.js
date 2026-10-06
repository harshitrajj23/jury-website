const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function clean() {
  await sql`DELETE FROM "Score" WHERE id LIKE 'bench_%' OR id LIKE 'temp_%' OR "judgeId" LIKE 'usr_load_%' OR "judgeId" LIKE 'usr_compl_%'`;
  await sql`DELETE FROM "User" WHERE id LIKE 'bench_%' OR id LIKE 'test_%' OR id LIKE 'usr_load_%' OR id LIKE 'usr_compl_%'`;
  const counts = await sql`
    SELECT 
      (SELECT COUNT(*) FROM "User") as users,
      (SELECT COUNT(*) FROM "Team") as teams,
      (SELECT COUNT(*) FROM "Criteria") as criteria,
      (SELECT COUNT(*) FROM "Score") as scores
  `;
  console.log('Database Status:', counts[0]);
}

clean().catch(console.error);
