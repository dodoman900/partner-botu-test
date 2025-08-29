const path = require("node:path");
const fs = require("node:fs");

let sqliteDb = null;
let lowdbInstance = null;
let dbMode = null; // 'sqlite' | 'lowdb' | null

async function init() {
  if (dbMode === "sqlite") return { type: "sqlite", db: sqliteDb };
  if (dbMode === "lowdb") return { type: "lowdb", db: lowdbInstance };

  const defaultData = {
    partners: [],
    bans: [],
    baskinReports: [],
  };

  // try sqlite (better-sqlite3) first if available
  try {
    const Database = require("better-sqlite3"); // optional dependency; safe require
    const dbDir = path.join(__dirname, "..", "..", "data");
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const file = path.join(dbDir, "data.sqlite");
    sqliteDb = new Database(file);
    // create simple tables if not exist; store json in TEXT columns
    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)`);
    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS partners (guildId TEXT PRIMARY KEY, data TEXT)`);
    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS bans (guildId TEXT PRIMARY KEY, data TEXT)`);
    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS baskin (id INTEGER PRIMARY KEY AUTOINCREMENT, guildId TEXT, data TEXT, createdAt TEXT)`);
    dbMode = "sqlite";
    console.info("SQLite (better-sqlite3) kullanılarak DB hazır:", file);
    return { type: "sqlite", db: sqliteDb };
  } catch (e) {
    // not available or failed -> fallback to lowdb
  }

  // lowdb fallback (JSON)
  try {
    const { Low } = require("lowdb");
    const { JSONFile } = require("lowdb/node");
    const dbDir = path.join(__dirname, "..", "..", "data");
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const file = path.join(dbDir, "db.json");
    // ensure file exists and valid
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
      try { fs.writeFileSync(file, JSON.stringify(defaultData, null, 2), "utf8"); } catch {}
    }
    const adapter = new JSONFile(file);
    lowdbInstance = new Low(adapter);
    try { await lowdbInstance.read(); } catch (e) {
      try { fs.copyFileSync(file, file + ".bak." + Date.now()); } catch {}
      lowdbInstance.data = defaultData;
      await lowdbInstance.write().catch(()=>{});
    }
    lowdbInstance.data = { ...defaultData, ...(lowdbInstance.data || {}) };
    await lowdbInstance.write().catch(()=>{});
    dbMode = "lowdb";
    console.info("LowDB hazır:", file);
    return { type: "lowdb", db: lowdbInstance };
  } catch (e) {
    console.error("Herhangi bir DB başlatılamadı:", e.message || e);
    dbMode = null;
    return null;
  }
}

// sqlite helpers (if sqlite active)
function _safeParseJSON(v){ try { return JSON.parse(v); } catch { return null; } }
function _safeStringify(v){ try { return JSON.stringify(v); } catch { return null; } }

async function getPartner(guildId) {
  if (dbMode === "sqlite" && sqliteDb) {
    const row = sqliteDb.prepare("SELECT data FROM partners WHERE guildId = ?").get(guildId);
    return row ? _safeParseJSON(row.data) : null;
  }
  if (dbMode === "lowdb" && lowdbInstance) {
    lowdbInstance.data ||= { partners: [] };
    return (lowdbInstance.data.partners || []).find(p => p.guildId === guildId) || null;
  }
  return null;
}
async function savePartner(partnerObj) {
  if (dbMode === "sqlite" && sqliteDb) {
    const json = _safeStringify(partnerObj) || "{}";
    sqliteDb.prepare("INSERT OR REPLACE INTO partners (guildId, data) VALUES (?, ?)").run(partnerObj.guildId, json);
    return partnerObj;
  }
  if (dbMode === "lowdb" && lowdbInstance) {
    lowdbInstance.data ||= { partners: [] };
    const idx = (lowdbInstance.data.partners || []).findIndex(p => p.guildId === partnerObj.guildId);
    if (idx === -1) lowdbInstance.data.partners.push(partnerObj);
    else lowdbInstance.data.partners[idx] = partnerObj;
    await lowdbInstance.write().catch(()=>{});
    return partnerObj;
  }
  return null;
}

async function getBans(guildId) {
  if (dbMode === "sqlite" && sqliteDb) {
    const row = sqliteDb.prepare("SELECT data FROM bans WHERE guildId = ?").get(guildId);
    return row ? _safeParseJSON(row.data) : null;
  }
  if (dbMode === "lowdb" && lowdbInstance) {
    lowdbInstance.data ||= { bans: [] };
    return (lowdbInstance.data.bans || []).find(b => b.guildId === guildId) || null;
  }
  return null;
}
async function saveBans(banObj) {
  if (dbMode === "sqlite" && sqliteDb) {
    const json = _safeStringify(banObj) || "{}";
    sqliteDb.prepare("INSERT OR REPLACE INTO bans (guildId, data) VALUES (?, ?)").run(banObj.guildId, json);
    return banObj;
  }
  if (dbMode === "lowdb" && lowdbInstance) {
    lowdbInstance.data ||= { bans: [] };
    const idx = (lowdbInstance.data.bans || []).findIndex(b => b.guildId === banObj.guildId);
    if (idx === -1) lowdbInstance.data.bans.push(banObj);
    else lowdbInstance.data.bans[idx] = banObj;
    await lowdbInstance.write().catch(()=>{});
    return banObj;
  }
  return null;
}

async function saveBaskinReport(guildId, report) {
  if (dbMode === "sqlite" && sqliteDb) {
    sqliteDb.prepare("INSERT INTO baskin (guildId, data, createdAt) VALUES (?, ?, ?)").run(guildId, _safeStringify(report) || "{}", new Date().toISOString());
    return report;
  }
  if (dbMode === "lowdb" && lowdbInstance) {
    lowdbInstance.data ||= { baskinReports: [] };
    lowdbInstance.data.baskinReports.push(report);
    await lowdbInstance.write().catch(()=>{});
    return report;
  }
  return null;
}
module.exports = {
  init,
  getPartner,
  savePartner,
  getBans,
  saveBans,
  saveBaskinReport,
  mode: () => dbMode,
};