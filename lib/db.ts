import { createClient, type InArgs } from "@libsql/client";

type SqlValue = string | number | null;
type NamedValues = Record<string, SqlValue>;

const url = process.env.TURSO_DATABASE_URL || "file:data/anxiety-journal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url,
  authToken,
  intMode: "number",
  timeout: 10000,
});

class Statement {
  constructor(private readonly sql: string) {}

  async run(...params: [NamedValues] | SqlValue[]) {
    const args = normalizeArgs(params);
    await client.execute({ sql: this.sql, args });
  }

  async all<T = unknown>(...params: SqlValue[]) {
    const result = await client.execute({ sql: this.sql, args: params });
    return result.rows as T[];
  }

  async get<T = unknown>(...params: SqlValue[]) {
    return (await this.all<T>(...params))[0];
  }
}

function normalizeArgs(params: [NamedValues] | SqlValue[]): InArgs {
  if (params.length === 1 && typeof params[0] === "object" && params[0] !== null) {
    return params[0] as NamedValues;
  }
  return params as SqlValue[];
}

export const db = {
  prepare(sql: string) { return new Statement(sql); },
  async exec(sql: string) { await client.executeMultiple(sql); },
};

/**
 * Run related mutations atomically. Roll back on errors before exposing partial state.
 */
export async function withDbTransaction<T>(
  work: (tx: Awaited<ReturnType<typeof client.transaction>>) => Promise<T>,
): Promise<T> {
  const tx = await client.transaction("write");
  try {
    const value = await work(tx);
    await tx.commit();
    return value;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

let initPromise: Promise<void> | null = null;

export function initDb() {
  initPromise ??= initialize();
  return initPromise;
}

async function initialize() {
  await db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      identifier TEXT NOT NULL,
      action TEXT NOT NULL,
      window_start TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (identifier, action, window_start)
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      mood TEXT,
      context TEXT,
      intensity INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 10),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reflections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reflection_date TEXT NOT NULL,
      title TEXT NOT NULL,
      what_happened TEXT NOT NULL,
      main_emotions TEXT NOT NULL,
      repeated_worries TEXT NOT NULL,
      trigger TEXT NOT NULL,
      known_facts TEXT NOT NULL,
      guesses TEXT NOT NULL,
      fear_meaning TEXT NOT NULL,
      anxiety_story TEXT NOT NULL,
      kinder_interpretation TEXT NOT NULL,
      companion_note TEXT NOT NULL DEFAULT '',
      next_step TEXT NOT NULL,
      theme_tags TEXT NOT NULL,
      intensity INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 10),
      created_at TEXT NOT NULL,
      UNIQUE (user_id, reflection_date)
    );

    CREATE INDEX IF NOT EXISTS entries_user_created_idx ON entries(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS reflections_user_date_idx ON reflections(user_id, reflection_date DESC);
    CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS password_reset_token_idx ON password_reset_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens(user_id, created_at DESC);
  `);

  const reflectionColumns = await db.prepare("PRAGMA table_info(reflections)").all<{ name: string }>();
  if (!reflectionColumns.some((column) => column.name === "companion_note")) {
    await db.exec("ALTER TABLE reflections ADD COLUMN companion_note TEXT NOT NULL DEFAULT ''");
  }
}
