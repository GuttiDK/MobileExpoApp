import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __db: {
    pool: Pool
    ready: Promise<void>
    prepare: (sql: string) => PreparedQuery
    query: (sql: string) => PreparedQuery
    exec: (sql: string) => Promise<void>
  } | undefined
}

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://homeapp:homeapp123@localhost:5432/homeapp'

const pool = global.__db?.pool ?? new Pool({ connectionString: DATABASE_URL })
let ready = global.__db?.ready

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
    await ready
    const result = await pool.query(toPostgresQuery(this.sql), normalizeParams(params))
    return result.rows[0]
  }

  async all(...params: unknown[]) {
    await ready
    const result = await pool.query(toPostgresQuery(this.sql), normalizeParams(params))
    return result.rows
  }

  async run(...params: unknown[]) {
    await ready
    await pool.query(toPostgresQuery(this.sql), normalizeParams(params))
  }
}

async function initSchema() {
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

    CREATE INDEX IF NOT EXISTS idx_sensor_room ON sensor_readings(room_id);
    CREATE INDEX IF NOT EXISTS idx_sensor_recorded ON sensor_readings(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_members_user ON house_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_members_house ON house_members(house_id);
  `)
}

ready = ready ?? initSchema()

global.__db = global.__db ?? {
  pool,
  ready,
  prepare: (sql: string) => new PreparedQuery(sql),
  query: (sql: string) => new PreparedQuery(sql),
  exec: async (sql: string) => {
    await ready
    await pool.query(sql)
  },
}

export default function getDb() {
  return global.__db!
}
