const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'heijunka.sqlite');
const legacyConfigPath = path.join(dataDir, 'heijunka_config.json');

let dbInstancePromise = null;

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) return reject(error);
      resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      resolve(row);
    });
  });
}

function toIsoDate(value) {
  if (typeof value !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function getCurrentWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  return monday.toISOString().split('T')[0];
}

function normalizePlan(weekStart, data = {}) {
  const legacyPlannedStops = Array.isArray(data.plannedStopBlocks) ? data.plannedStopBlocks : [];
  return {
    weekStart,
    batches: Array.isArray(data.batches) ? data.batches : [],
    maintenanceBlocks: Array.isArray(data.maintenanceBlocks) ? data.maintenanceBlocks : [],
    setupBlocks: Array.isArray(data.setupBlocks) ? data.setupBlocks : [],
    programmedStopBlocks: Array.isArray(data.programmedStopBlocks) ? data.programmedStopBlocks : [],
    plannedStopBlocks: legacyPlannedStops,
    lastUpdated: data.lastUpdated || new Date().toISOString()
  };
}

async function migrateLegacyConfig(db) {
  const migrated = await get(db, 'SELECT value FROM heijunka_meta WHERE key = ?', ['legacy_migrated']);
  if (migrated) return;

  if (fs.existsSync(legacyConfigPath)) {
    try {
      const raw = fs.readFileSync(legacyConfigPath, 'utf8');
      const parsed = JSON.parse(raw);
      const legacyWeekStart = toIsoDate(parsed.weekStart) || getCurrentWeekStart();
      const legacyPlan = normalizePlan(legacyWeekStart, parsed);

      await run(
        db,
        'INSERT OR REPLACE INTO heijunka_plans (week_start, plan_json, updated_at) VALUES (?, ?, ?)',
        [legacyWeekStart, JSON.stringify(legacyPlan), new Date().toISOString()]
      );
    } catch (error) {
      console.error('Error migrating legacy Heijunka JSON config:', error);
    }
  }

  await run(
    db,
    'INSERT OR REPLACE INTO heijunka_meta (key, value) VALUES (?, ?)',
    ['legacy_migrated', new Date().toISOString()]
  );
}

async function initHeijunkaDb() {
  if (dbInstancePromise) return dbInstancePromise;

  dbInstancePromise = new Promise((resolve, reject) => {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (error) {
      return reject(error);
    }

    const db = new sqlite3.Database(dbPath, async (openError) => {
      if (openError) return reject(openError);

      try {
        await run(
          db,
          `CREATE TABLE IF NOT EXISTS heijunka_plans (
            week_start TEXT PRIMARY KEY,
            plan_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )`
        );

        await run(
          db,
          `CREATE TABLE IF NOT EXISTS heijunka_meta (
            key TEXT PRIMARY KEY,
            value TEXT
          )`
        );

        await migrateLegacyConfig(db);
        resolve(db);
      } catch (error) {
        reject(error);
      }
    });
  });

  return dbInstancePromise;
}

async function getPlanByWeek(weekStartInput) {
  const weekStart = toIsoDate(weekStartInput) || getCurrentWeekStart();
  const db = await initHeijunkaDb();

  const row = await get(db, 'SELECT plan_json FROM heijunka_plans WHERE week_start = ?', [weekStart]);
  if (!row) return normalizePlan(weekStart, {});

  try {
    const parsed = JSON.parse(row.plan_json);
    return normalizePlan(weekStart, parsed);
  } catch (error) {
    console.error('Error parsing week plan JSON from DB:', error);
    return normalizePlan(weekStart, {});
  }
}

async function upsertPlan(plan) {
  const weekStart = toIsoDate(plan.weekStart);
  if (!weekStart) {
    throw new Error('Invalid or missing weekStart. Expected format YYYY-MM-DD');
  }

  const normalized = normalizePlan(weekStart, plan);
  const db = await initHeijunkaDb();

  await run(
    db,
    'INSERT OR REPLACE INTO heijunka_plans (week_start, plan_json, updated_at) VALUES (?, ?, ?)',
    [weekStart, JSON.stringify(normalized), new Date().toISOString()]
  );

  return normalized;
}

async function deletePlanByWeek(weekStartInput) {
  const weekStart = toIsoDate(weekStartInput);
  if (!weekStart) {
    throw new Error('Invalid or missing weekStart. Expected format YYYY-MM-DD');
  }

  const db = await initHeijunkaDb();
  await run(db, 'DELETE FROM heijunka_plans WHERE week_start = ?', [weekStart]);

  return { weekStart };
}

module.exports = {
  initHeijunkaDb,
  getPlanByWeek,
  upsertPlan,
  deletePlanByWeek
};
