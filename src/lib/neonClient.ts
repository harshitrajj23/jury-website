import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let sqlClient: NeonQueryFunction<false, false> | null = null;

export function getDb() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    console.warn("⚠️ DATABASE_URL is not configured in environment variables.");
    throw new Error("DATABASE_URL is missing. Please set DATABASE_URL in your environment variables.");
  }
  
  if (!sqlClient) {
    sqlClient = neon(connectionString);
  }
  return sqlClient;
}
