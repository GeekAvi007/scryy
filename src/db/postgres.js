import pg from 'pg';

const { Pool } = pg;

let pool = null;

export async function initDb() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[POSTGRES] DATABASE_URL not set — running in guest-only mode.');
    return;
  }

  try {
    pool = new Pool({
      connectionString: dbUrl,
      ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(16) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        games_played INT NOT NULL DEFAULT 0,
        words_guessed INT NOT NULL DEFAULT 0,
        total_score INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('[POSTGRES] Connected & users table verified.');
  } catch (err) {
    console.error('[POSTGRES] Connection failed — falling back to guest-only mode:', err.message);
    pool = null;
  }
}

export function isDbAvailable() {
  return pool !== null;
}

export async function query(text, params) {
  if (!pool) throw new Error('Database is not configured.');
  return pool.query(text, params);
}

export async function recordMatchStats(players) {
  if (!pool) return;

  const authPlayers = players.filter((p) => p.userId !== null);
  if (authPlayers.length === 0) return;

  try {
    await Promise.all(
      authPlayers.map((p) =>
        pool.query(
          `UPDATE users
           SET games_played = games_played + 1,
               words_guessed = words_guessed + $1,
               total_score = total_score + $2
           WHERE id = $3`,
          [p.wordsGuessed, p.score, p.userId]
        )
      )
    );
    console.log(`[POSTGRES] Persisted match stats for ${authPlayers.length} authenticated player(s).`);
  } catch (err) {
    console.error('[POSTGRES] Failed to persist match stats:', err.message);
  }
}