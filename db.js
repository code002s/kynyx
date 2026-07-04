const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const DEFAULT_SETTINGS = {
  onjoin: true,
  onlog: true,
  banasync: true,
};

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value BOOLEAN NOT NULL
    )
  `);
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [k, v]
    );
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bans (
      id SERIAL PRIMARY KEY,
      userid TEXT NOT NULL UNIQUE,
      username TEXT,
      display_name TEXT,
      reason TEXT DEFAULT '',
      ban_type TEXT DEFAULT 'normal',
      duration INTEGER DEFAULT -1,
      executor TEXT DEFAULT 'System',
      timestamp BIGINT DEFAULT 0,
      data JSONB DEFAULT '{}'
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blacklist (
      id SERIAL PRIMARY KEY,
      asset_id TEXT NOT NULL UNIQUE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whitelist (
      id SERIAL PRIMARY KEY,
      userid TEXT NOT NULL UNIQUE,
      username TEXT DEFAULT '',
      display_name TEXT DEFAULT ''
    )
  `);
  await pool.query(`ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS username TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT ''`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS suspicious_accounts (
      id SERIAL PRIMARY KEY,
      userid TEXT NOT NULL UNIQUE,
      data JSONB DEFAULT '{}'
    )
  `);
  // Queue + live state — moved out of in-process memory so it survives
  // serverless cold starts / multiple instances (e.g. on Vercel).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS command_queue (
      id SERIAL PRIMARY KEY,
      payload JSONB NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_servers (
      job_id TEXT PRIMARY KEY,
      players INTEGER DEFAULT 0,
      ping TEXT DEFAULT 'N/A',
      target_player TEXT DEFAULT '—',
      last_seen BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS execute_results (
      execution_id TEXT PRIMARY KEY,
      success BOOLEAN,
      output TEXT,
      error TEXT,
      created_at BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_state (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    )
  `);
}

// ── COMMAND QUEUE / LIVE STATE (replaces old in-memory `state`) ────────

async function pushCommand(payload) {
  await pool.query(
    `INSERT INTO command_queue (payload, created_at) VALUES ($1, $2)`,
    [JSON.stringify({ ...payload, ts: Date.now() }), Date.now()]
  );
}
async function getCommands() {
  const { rows } = await pool.query(`SELECT payload FROM command_queue ORDER BY id ASC`);
  return rows.map((r) => r.payload);
}
async function clearCommands() {
  await pool.query(`DELETE FROM command_queue`);
}

async function setPlayerState(count, players) {
  await pool.query(
    `INSERT INTO live_state (key, value) VALUES ('players', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify({ count, players })]
  );
}
async function getPlayerState() {
  const { rows } = await pool.query(`SELECT value FROM live_state WHERE key = 'players'`);
  return rows[0]?.value || { count: 0, players: [] };
}

const SERVER_TTL_MS = 60_000;
async function upsertServer(entry) {
  await pool.query(
    `INSERT INTO game_servers (job_id, players, ping, target_player, last_seen)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (job_id) DO UPDATE SET
       players = EXCLUDED.players, ping = EXCLUDED.ping,
       target_player = EXCLUDED.target_player, last_seen = EXCLUDED.last_seen`,
    [entry.jobId, entry.players, entry.ping, entry.targetPlayer, entry.lastSeen]
  );
}
async function getServers() {
  await pool.query(`DELETE FROM game_servers WHERE last_seen < $1`, [Date.now() - SERVER_TTL_MS]);
  const { rows } = await pool.query(`SELECT job_id, players, ping, target_player, last_seen FROM game_servers`);
  return rows.map((r) => ({
    jobId: r.job_id,
    players: r.players,
    ping: r.ping,
    targetPlayer: r.target_player,
    lastSeen: Number(r.last_seen),
  }));
}

async function setExecuteResult(executionId, result) {
  await pool.query(
    `INSERT INTO execute_results (execution_id, success, output, error, created_at) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (execution_id) DO UPDATE SET success = EXCLUDED.success, output = EXCLUDED.output, error = EXCLUDED.error`,
    [executionId, !!result.success, result.output ?? null, result.error ?? null, Date.now()]
  );
}
async function takeExecuteResult(executionId) {
  const { rows } = await pool.query(`SELECT success, output, error FROM execute_results WHERE execution_id = $1`, [executionId]);
  if (!rows.length) return null;
  await pool.query(`DELETE FROM execute_results WHERE execution_id = $1`, [executionId]);
  return rows[0];
}

// ── BANS ──────────────────────────────────────────────────────────────

async function getBans() {
  const { rows } = await pool.query(`SELECT * FROM bans ORDER BY id DESC`);
  return rows.map((r) => {
    const entry = { ...(r.data || {}) };
    return {
      ...entry,
      userid: r.userid,
      username: r.username || entry.username || 'Unknown',
      display_name: r.display_name || entry.display_name || 'Unknown',
      reason: r.reason,
      banType: r.ban_type,
      duration: r.duration,
      executor: r.executor,
      timestamp: Number(r.timestamp),
    };
  });
}

async function addBan(data) {
  const uid = String(data.userid || '');
  if (!uid) return false;
  await pool.query(
    `
    INSERT INTO bans (userid, username, display_name, reason, ban_type, duration, executor, timestamp, data)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (userid) DO UPDATE SET
      username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      reason = EXCLUDED.reason,
      ban_type = EXCLUDED.ban_type,
      duration = EXCLUDED.duration,
      executor = EXCLUDED.executor,
      timestamp = EXCLUDED.timestamp,
      data = EXCLUDED.data
    `,
    [
      uid,
      data.username || 'Unknown',
      data.display_name || data.username || 'Unknown',
      data.reason || '',
      data.banType || data.type || 'normal',
      data.duration ?? -1,
      data.executor || data.bannedBy || 'System',
      data.timestamp || 0,
      JSON.stringify(data),
    ]
  );
  return true;
}

async function removeBan(userid) {
  await pool.query(`DELETE FROM bans WHERE userid = $1`, [String(userid)]);
  return true;
}

async function isBanned(userid) {
  const { rows } = await pool.query(`SELECT 1 FROM bans WHERE userid = $1`, [String(userid)]);
  return rows.length > 0;
}

// ── BLACKLIST ─────────────────────────────────────────────────────────

async function getBlacklist() {
  const { rows } = await pool.query(`SELECT asset_id FROM blacklist`);
  return rows.map((r) => r.asset_id);
}
async function addBlacklist(assetId) {
  await pool.query(`INSERT INTO blacklist (asset_id) VALUES ($1) ON CONFLICT DO NOTHING`, [assetId]);
}
async function removeBlacklist(assetId) {
  await pool.query(`DELETE FROM blacklist WHERE asset_id = $1`, [assetId]);
}

// ── WHITELIST ─────────────────────────────────────────────────────────

async function getWhitelist() {
  const { rows } = await pool.query(`SELECT userid FROM whitelist`);
  return rows.map((r) => r.userid);
}
async function getWhitelistFull() {
  const { rows } = await pool.query(`SELECT userid, username, display_name FROM whitelist ORDER BY id DESC`);
  return rows.map((r) => ({
    userId: r.userid,
    username: r.username || '',
    displayName: r.display_name || '',
  }));
}
async function addWhitelist(userid, username = '', displayName = '') {
  await pool.query(
    `INSERT INTO whitelist (userid, username, display_name) VALUES ($1, $2, $3)
     ON CONFLICT (userid) DO UPDATE SET
       username = COALESCE(NULLIF(EXCLUDED.username, ''), whitelist.username),
       display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), whitelist.display_name)`,
    [String(userid), username || '', displayName || '']
  );
}
async function updateWhitelistNames(userid, username, displayName) {
  await pool.query(
    `UPDATE whitelist SET username = $2, display_name = $3 WHERE userid = $1`,
    [String(userid), username || '', displayName || '']
  );
}
async function removeWhitelist(userid) {
  await pool.query(`DELETE FROM whitelist WHERE userid = $1`, [String(userid)]);
}

// ── SUSPICIOUS ────────────────────────────────────────────────────────

async function getSuspicious() {
  const { rows } = await pool.query(`SELECT data FROM suspicious_accounts`);
  return rows.map((r) => r.data || {});
}
async function addSuspicious(data) {
  const uid = String(data.userid || '');
  if (!uid) return;
  await pool.query(
    `INSERT INTO suspicious_accounts (userid, data) VALUES ($1, $2)
     ON CONFLICT (userid) DO UPDATE SET data = EXCLUDED.data`,
    [uid, JSON.stringify(data)]
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────

async function getSettings() {
  const { rows } = await pool.query(`SELECT key, value FROM settings`);
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
async function updateSettings(updates) {
  for (const [k, v] of Object.entries(updates)) {
    if (k in DEFAULT_SETTINGS) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [k, Boolean(v)]
      );
    }
  }
}

module.exports = {
  pool,
  initDb,
  getBans,
  addBan,
  removeBan,
  isBanned,
  getBlacklist,
  addBlacklist,
  removeBlacklist,
  getWhitelist,
  getWhitelistFull,
  addWhitelist,
  updateWhitelistNames,
  removeWhitelist,
  getSuspicious,
  addSuspicious,
  getSettings,
  updateSettings,
  pushCommand,
  getCommands,
  clearCommands,
  setPlayerState,
  getPlayerState,
  upsertServer,
  getServers,
  setExecuteResult,
  takeExecuteResult,
};
