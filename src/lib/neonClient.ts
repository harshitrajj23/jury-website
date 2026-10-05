import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let sqlClient: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  
  if (!connectionString) {
    // Return a fallback no-op query function during static build / prerender if env var is not yet present
    const fallbackSql = (async () => {
      console.warn("⚠️ DATABASE_URL is not set. Database query skipped.");
      return [];
    }) as unknown as NeonQueryFunction<false, false>;
    return fallbackSql;
  }
  
  if (!sqlClient) {
    sqlClient = neon(connectionString);
  }
  return sqlClient;
}
