// Database Connection & Transaction Layer
// PostgreSQL pool with SSL & Supabase Pooler support

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

let globalPool: Pool | null = null;

export function getDbPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  if (!globalPool) {
    globalPool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    globalPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client pool:', err);
    });
  }

  return globalPool;
}

export async function dbQuery<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getDbPool();
  if (!pool) {
    throw new Error('DATABASE_URL is not configured');
  }
  return pool.query<T>(text, params);
}

/**
 * Executes a function within an atomic PostgreSQL transaction.
 * Rolls back automatically on any error.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDbPool();
  if (!pool) {
    throw new Error('DATABASE_URL is not configured for transaction');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
