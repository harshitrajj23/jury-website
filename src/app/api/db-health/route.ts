import { NextResponse } from "next/server";
import { getDb } from "@/lib/neonClient";
import { initDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (!dbUrl) {
    return NextResponse.json({
      status: "error",
      databaseUrlConfigured: false,
      message: "DATABASE_URL is not set in Vercel Environment Variables. Please add your Neon connection string in Vercel Settings -> Environment Variables.",
    }, { status: 500 });
  }

  try {
    // 1. Test connection
    const sql = getDb();
    const [{ now }] = await sql`SELECT NOW() as now;`;

    // 2. Ensure tables are verified
    await initDatabase();

    // 3. Check existing tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('User', 'Team', 'Criteria', 'Score', 'Settings', 'AuditLog');
    `;

    const [{ judgeCount }] = await sql`SELECT count(*)::int as "judgeCount" FROM "User";`;
    const [{ teamCount }] = await sql`SELECT count(*)::int as "teamCount" FROM "Team";`;
    const [{ criteriaCount }] = await sql`SELECT count(*)::int as "criteriaCount" FROM "Criteria";`;
    const [{ scoreCount }] = await sql`SELECT count(*)::int as "scoreCount" FROM "Score";`;

    return NextResponse.json({
      status: "healthy",
      databaseUrlConfigured: true,
      connectedAt: now,
      tables: tables.map((t: any) => t.table_name),
      data: {
        users_and_judges: judgeCount,
        teams: teamCount,
        criteria: criteriaCount,
        scores: scoreCount,
      },
      message: "Neon Database (User, Team, Criteria, Score, Settings, AuditLog) is connected and fully operational!",
    });
  } catch (err: any) {
    return NextResponse.json({
      status: "connection_error",
      databaseUrlConfigured: true,
      error: err?.message || String(err),
      hint: "Check if your Neon database credentials, password, and endpoint in DATABASE_URL are correct.",
    }, { status: 500 });
  }
}
