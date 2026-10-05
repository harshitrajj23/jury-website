import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let sqlClient: NeonQueryFunction<false, false> | null = null;
let lastConnectionString: string | null = null;

function getSanitizedUrl(): string | null {
  const raw = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^["']|["']$/g, '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getDb(): NeonQueryFunction<false, false> {
  const connectionString = getSanitizedUrl();
  
  if (!connectionString) {
    // Return a dummy handler during static builds or throw a clear error at runtime
    const fallbackSql = (async () => {
      throw new Error("DATABASE_URL is not configured in Vercel. Please add your Neon connection string in Vercel Project Settings -> Environment Variables.");
    }) as unknown as NeonQueryFunction<false, false>;
    return fallbackSql;
  }
  
  if (!sqlClient || lastConnectionString !== connectionString) {
    sqlClient = neon(connectionString);
    lastConnectionString = connectionString;
  }
  
  return sqlClient;
}
