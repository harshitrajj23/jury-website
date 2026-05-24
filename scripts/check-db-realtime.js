require("dotenv").config();
const { Client } = require("pg");

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Missing DIRECT_URL or DATABASE_URL in .env");
  process.exit(1);
}

async function main() {
  console.log("🔍 Checking Database Realtime Configurations...");
  console.log(`📡 URL: ${connectionString.split("@")[1] || "Local/hidden"}`);
  console.log("");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase external connections
  });

  try {
    await client.connect();
    console.log("✅ Connected to Postgres database successfully!");
    console.log("");

    // 1. Check all publications
    console.log("📋 1. Publications in the database:");
    const pubRes = await client.query("SELECT * FROM pg_publication;");
    if (pubRes.rows.length === 0) {
      console.log("   ❌ No publications found!");
    } else {
      pubRes.rows.forEach(pub => {
        console.log(`   - Name: "${pub.pubname}", Owner ID: ${pub.pubowner}, All Tables: ${pub.puballtables}`);
      });
    }
    console.log("");

    // 2. Check supabase_realtime tables
    console.log("📋 2. Tables in 'supabase_realtime' publication:");
    const tablesRes = await client.query("SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';");
    if (tablesRes.rows.length === 0) {
      console.log("   ❌ No tables in 'supabase_realtime' publication!");
    } else {
      tablesRes.rows.forEach(row => {
        console.log(`   - Table: "${row.schemaname}.${row.tablename}"`);
      });
    }
    console.log("");

    // 3. Check replication identity and RLS of our tables
    console.log("📋 3. Table replication identities and RLS status:");
    const tablesToCheck = ['pals_teams', 'pals_scores', 'pals_judges', 'pals_config'];
    for (const table of tablesToCheck) {
      const repIdRes = await client.query(`
        SELECT relreplident, relrowsecurity, relforcerowsecurity 
        FROM pg_class 
        WHERE relname = $1 AND relnamespace = 'public'::regnamespace;
      `, [table]);
      
      if (repIdRes.rows.length === 0) {
        console.log(`   - "${table}": ❌ Table NOT FOUND!`);
      } else {
        const row = repIdRes.rows[0];
        const code = row.relreplident;
        let identityDesc = "Unknown";
        if (code === 'd') identityDesc = "default (primary key)";
        if (code === 'n') identityDesc = "nothing";
        if (code === 'f') identityDesc = "full (entire row)";
        if (code === 'i') identityDesc = "index (custom index)";
        
        const rlsEnabled = row.relrowsecurity;
        const rlsForced = row.relforcerowsecurity;
        console.log(`   - "${table}": identity = '${code}' (${identityDesc}) | RLS Enabled = ${rlsEnabled} | RLS Forced = ${rlsForced}`);
        
        // Check privileges
        const privRes = await client.query(`
          SELECT grantee, privilege_type 
          FROM information_schema.role_table_grants 
          WHERE table_name = $1 AND table_schema = 'public';
        `, [table]);
        const grants = {};
        privRes.rows.forEach(p => {
          if (!grants[p.grantee]) grants[p.grantee] = [];
          grants[p.grantee].push(p.privilege_type);
        });
        console.log(`     Grants:`, Object.entries(grants).map(([role, privs]) => `${role}: [${privs.join(', ')}]`).join(' | '));
      }
    }
    console.log("");

  } catch (err) {
    console.error("❌ Database query error:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
