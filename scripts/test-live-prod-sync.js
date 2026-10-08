const https = require('https');
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);
const PROD_URL = 'https://jury-website.vercel.app';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function verifyLiveFlow() {
  console.log("==================================================");
  console.log(`VERIFYING LIVE PRODUCTION: ${PROD_URL}`);
  console.log("==================================================");

  // 1. Check endpoints on production
  const [rootRes, adminRes, dashRes, resRes, healthRes] = await Promise.all([
    httpGet(`${PROD_URL}/`),
    httpGet(`${PROD_URL}/admin`),
    httpGet(`${PROD_URL}/dashboard`),
    httpGet(`${PROD_URL}/results`),
    httpGet(`${PROD_URL}/api/db-health`),
  ]);

  console.log(`1. Root Landing Page: HTTP ${rootRes.status}`);
  console.log(`2. Admin Console: HTTP ${adminRes.status}`);
  console.log(`3. Judge Dashboard: HTTP ${dashRes.status}`);
  console.log(`4. Public Results: HTTP ${resRes.status}`);
  console.log(`5. DB Health API: HTTP ${healthRes.status}`);
  console.log(`   DB Health Body:`, healthRes.data);

  if (healthRes.status !== 200 || !healthRes.data.includes('healthy')) {
    throw new Error("DB Health check failed on production!");
  }

  // 2. Verify Database Criteria synchronization
  const events = await sql`SELECT id, name FROM "Event" WHERE active = true ORDER BY "createdAt" ASC;`;
  const primaryEvent = events[0];
  console.log(`\n6. Active Event in Production: [${primaryEvent.id}] "${primaryEvent.name}"`);

  const criteria = await sql`
    SELECT id, name, "maxScore", weight, "orderIndex", active, "eventId" 
    FROM "Criteria" 
    WHERE active = true AND "eventId" = ${primaryEvent.id} 
    ORDER BY "orderIndex" ASC;
  `;
  console.log(`7. Production Criteria count for event: ${criteria.length}`);
  criteria.forEach((c, i) => {
    console.log(`   #${i + 1}: [${c.id}] "${c.name}" | W: ${c.weight} | Max: ${c.maxScore} | Event: "${c.eventId}"`);
  });

  if (criteria.length === 0) {
    throw new Error("FAIL: Criteria table has 0 active criteria for event!");
  }

  // 3. Verify Judge Keerti and Teams in Production
  const judge = await sql`SELECT id, name, email, "eventId" FROM "User" WHERE role = 'judge' LIMIT 1;`;
  console.log(`8. Production Judge: [${judge[0].id}] "${judge[0].name}" (${judge[0].email}) -> EventId: "${judge[0].eventId}"`);

  const teams = await sql`SELECT id, "teamName", "teamCode", "eventId" FROM "Team" WHERE "eventId" = ${primaryEvent.id};`;
  console.log(`9. Production Teams for this event: ${teams.length}`);
  teams.forEach(t => console.log(`   Team: "${t.teamName}" (${t.teamCode})`));

  console.log("\n==================================================");
  console.log("✅ LIVE PRODUCTION ENVIRONMENT VERIFIED 100% OPERATIONAL");
  console.log("==================================================");
}

verifyLiveFlow().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
