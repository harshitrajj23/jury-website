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

    // 2. Ensure tables are created
    await initDatabase();

    // 3. Check existing tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'pals_%';
    `;

    const [{ judgeCount }] = await sql`SELECT count(*)::int as "judgeCount" FROM pals_judges;`;
    const [{ teamCount }] = await sql`SELECT count(*)::int as "teamCount" FROM pals_teams;`;
    const [{ scoreCount }] = await sql`SELECT count(*)::int as "scoreCount" FROM pals_scores;`;

    return NextResponse.json({
      status: "healthy",
      databaseUrlConfigured: true,
      connectedAt: now,
      tables: tables.map((t: any) => t.table_name),
      data: {
        judges: judgeCount,
        teams: teamCount,
        scores: scoreCount,
      },
      message: "Neon Database is connected and fully operational!",
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
