import { Pool } from 'pg'

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://homeapp:homeapp123@localhost:5432/homeapp'

let _pool: Pool | undefined
let _ready: Promise<void> | undefined

function getPool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: DATABASE_URL })
  return _pool
}

function ensureReady(): Promise<void> {
  if (!_ready) _ready = initSchema()
  return _ready
}

function toPostgresQuery(sql: string) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

function normalizeParams(params: unknown[] | unknown) {
  if (params === undefined || params === null) return []
  if (Array.isArray(params) && params.length === 1 && Array.isArray(params[0])) {
    return params[0] as unknown[]
  }
  if (Array.isArray(params)) return params
  return [params]
}

class PreparedQuery {
  constructor(private sql: string) {}

  async get(...params: unknown[]) {
    await ensureReady()
    const result = await getPool().query(toPostgresQuery(this.sql), normalizeParams(params))
    return result.rows[0]
  }

  async all(...params: unknown[]) {
    await ensureReady()
    const result = await getPool().query(toPostgresQuery(this.sql), normalizeParams(params))
    return result.rows
  }

  async run(...params: unknown[]) {
    await ensureReady()
    await getPool().query(toPostgresQuery(this.sql), normalizeParams(params))
  }
}

async function initSchema() {
  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS houses (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      invite_code TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS house_members (
      id SERIAL PRIMARY KEY,
      house_id INTEGER NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(house_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      house_id INTEGER NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT '🏠',
      mqtt_topic TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id SERIAL PRIMARY KEY,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      temperature DOUBLE PRECISION,
      humidity DOUBLE PRECISION,
      recorded_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS devices (
      ieee_address TEXT PRIMARY KEY,
      friendly_name TEXT NOT NULL,
      type TEXT,
      model TEXT,
      vendor TEXT,
      description TEXT,
      supported BOOLEAN DEFAULT true,
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      exposes JSONB,
      last_seen TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS device_states (
      ieee_address TEXT PRIMARY KEY REFERENCES devices(ieee_address) ON DELETE CASCADE,
      state JSONB,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_sensor_room ON sensor_readings(room_id);
    CREATE INDEX IF NOT EXISTS idx_sensor_recorded ON sensor_readings(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_members_user ON house_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_members_house ON house_members(house_id);
    CREATE INDEX IF NOT EXISTS idx_devices_room ON devices(room_id);
    CREATE INDEX IF NOT EXISTS idx_devices_friendly ON devices(friendly_name);
  `)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`)
}

export default function getDb() {
  return {
    prepare: (sql: string) => new PreparedQuery(sql),
    query: (sql: string) => new PreparedQuery(sql),
    exec: async (sql: string) => {
      await ensureReady()
      await getPool().query(sql)
    },
  }
}
