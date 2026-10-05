import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let sqlClient: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  
  if (!connectionString) {
    // If running in a server action or API call at runtime, notify user clearly
    const fallbackSql = (async () => {
      throw new Error("DATABASE_URL is not configured in Vercel. Please add your Neon connection string as DATABASE_URL in Vercel Project Settings -> Environment Variables.");
    }) as unknown as NeonQueryFunction<false, false>;
    return fallbackSql;
  }
  
  if (!sqlClient) {
    sqlClient = neon(connectionString);
  }
  return sqlClient;
}
