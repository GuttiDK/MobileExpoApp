import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://homeapp:homeapp123@localhost:5432/homeapp";

const pool = new Pool({ connectionString: DATABASE_URL });

function toPostgresQuery(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function normalizeParams(params: unknown[] | unknown) {
  if (params === undefined || params === null) return [];
  if (Array.isArray(params) && params.length === 1 && Array.isArray(params[0])) {
    return params[0] as unknown[];
  }
  if (Array.isArray(params)) return params;
  return [params];
}

class PreparedQuery {
  constructor(private sql: string) {}

  async get(...params: unknown[]) {
    const result = await pool.query(toPostgresQuery(this.sql), normalizeParams(params));
    return result.rows[0];
  }

  async all(...params: unknown[]) {
    const result = await pool.query(toPostgresQuery(this.sql), normalizeParams(params));
    return result.rows;
  }

  async run(...params: unknown[]) {
    return await pool.query(toPostgresQuery(this.sql), normalizeParams(params));
  }
}

export const db = {
  query: (sql: string) => new PreparedQuery(sql),
  prepare: (sql: string) => new PreparedQuery(sql),
  async run(sql: string, params?: unknown[] | unknown) {
    return await pool.query(toPostgresQuery(sql), normalizeParams(params));
  },
  async exec(sql: string) {
    return await pool.query(sql);
  },
};

async function initSchema() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS houses (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invite_code TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS house_members (
      id SERIAL PRIMARY KEY,
      house_id INTEGER NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'viewer',
      joined_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(house_id, user_id)
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      house_id INTEGER NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'thermometer',
      mqtt_topic TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id SERIAL PRIMARY KEY,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      temperature DOUBLE PRECISION,
      humidity DOUBLE PRECISION,
      recorded_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await db.exec(`CREATE INDEX IF NOT EXISTS idx_sensor_readings_room_id ON sensor_readings(room_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at ON sensor_readings(recorded_at);`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id SERIAL PRIMARY KEY,
      friendly_name TEXT UNIQUE NOT NULL,
      ieee_address TEXT UNIQUE,
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      type TEXT NOT NULL DEFAULT 'unknown',
      model TEXT,
      vendor TEXT,
      description TEXT,
      definition JSONB,
      state JSONB NOT NULL DEFAULT '{}',
      last_seen TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_devices_room ON devices(room_id);`);
}

async function connectWithRetry(retries = 10, delayMs = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await initSchema();
      console.log("Database initialized");
      return;
    } catch (err: any) {
      if (i === retries - 1) throw err;
      console.log(`Database not ready, retrying in ${delayMs}ms... (${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

await connectWithRetry();
