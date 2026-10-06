import { NextResponse } from "next/server";
import { getDb } from "@/lib/neonClient";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (!dbUrl) {
    return NextResponse.json({
      status: "error",
      databaseUrlConfigured: false,
      message: "DATABASE_URL is not set in Environment Variables.",
    }, { status: 500 });
  }

  try {
    const sql = getDb();
    
    // Single consolidated fast query (<150ms)
    const [result] = await sql`
      SELECT 
        NOW() as now,
        (SELECT count(*)::int FROM "User") as "judgeCount",
        (SELECT count(*)::int FROM "Team") as "teamCount",
        (SELECT count(*)::int FROM "Criteria" WHERE active = true) as "criteriaCount",
        (SELECT count(*)::int FROM "Score") as "scoreCount";
    `;

    return NextResponse.json({
      status: "healthy",
      databaseUrlConfigured: true,
      connectedAt: result.now,
      tables: ["User", "Team", "Criteria", "Score", "Settings", "AuditLog"],
      data: {
        users_and_judges: result.judgeCount,
        teams: result.teamCount,
        criteria: result.criteriaCount,
        scores: result.scoreCount,
      },
      message: "Neon Database is connected and fully operational!",
    });
  } catch (err: any) {
    return NextResponse.json({
      status: "connection_error",
      databaseUrlConfigured: true,
      error: err?.message || String(err),
      hint: "Check if your Neon database credentials and endpoint in DATABASE_URL are correct.",
    }, { status: 500 });
  }
}
