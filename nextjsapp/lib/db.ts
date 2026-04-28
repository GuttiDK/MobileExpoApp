import Database from 'better-sqlite3'
import path from 'path'

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS houses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      invite_code TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS house_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      house_id INTEGER NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT DEFAULT (datetime('now')),
      UNIQUE(house_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      house_id INTEGER NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT '🏠',
      mqtt_topic TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      temperature REAL,
      humidity REAL,
      recorded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sensor_room ON sensor_readings(room_id);
    CREATE INDEX IF NOT EXISTS idx_sensor_recorded ON sensor_readings(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_members_user ON house_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_members_house ON house_members(house_id);
  `)
}

function getDb(): Database.Database {
  if (!global.__db) {
    const dbPath = process.env.DATABASE_PATH
      ? path.resolve(process.env.DATABASE_PATH)
      : path.join(process.cwd(), 'homeapp.db')

    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
    global.__db = db
  }
  return global.__db
}

export default getDb
