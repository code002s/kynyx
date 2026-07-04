const express = require('express');
const path = require('path');
const axios = require('axios');
const db = require('./db');

// Look up Roblox usernames in batch (max 100 per request)
async function lookupUsernames(userIds) {
  const ids = [...new Set(userIds.map((x) => String(x)).filter((x) => /^\d+$/.test(x)))];
  const out = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100).map(Number);
    try {
      const { data } = await axios.post(
        'https://users.roblox.com/v1/users',
        { userIds: chunk, excludeBannedUsers: false },
        { timeout: 8000 }
      );
      for (const u of data?.data || []) {
        out.set(String(u.id), { username: u.name, displayName: u.displayName });
      }
    } catch {
      /* ignore — fields will stay empty */
    }
  }
  return out;
}

const app = express();
app.use(express.json({ limit: '5mb' }));

const GAME_API_KEY = process.env.GAME_API_KEY || '';

// State lives in Postgres now (see db.js) instead of process memory, so it
// survives cold starts and works correctly across multiple serverless
// instances (e.g. when this API runs on Vercel).
const pushCommand = db.pushCommand;

function requireGameKey(req, res, next) {
  if (!GAME_API_KEY) return res.status(503).json({ error: 'Server not configured' });
  const key = req.headers['x-api-key'] || '';
  if (key !== GAME_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'favicon.ico'), (err) => {
    if (err) res.status(404).end();
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'), (err) => {
    if (err) res.send('kynxyy bot — running');
  });
});

// ─── ROBLOX-FACING ENDPOINTS (used by the in-game script) ───────────

// Roblox polls this to receive queued commands from the bot
app.get('/get_commands', async (req, res) => {
  res.json(await db.getCommands());
});

app.post('/clear_commands', async (req, res) => {
  await db.clearCommands();
  res.json({ status: 'cleared' });
});

// Roblox heartbeat; reports players + (optional) per-server info
app.post('/update_players', async (req, res) => {
  const data = req.body || {};
  await db.setPlayerState(data.count || 0, data.players || []);

  if (data.jobId) {
    await db.upsertServer({
      jobId: data.jobId,
      players: data.count || (data.players ? data.players.length : 0),
      ping: data.ping || 'N/A',
      targetPlayer: data.targetPlayer || (data.players?.[0]?.username || data.players?.[0]?.name) || '—',
      lastSeen: Date.now(),
    });
  }
  res.json({ status: 'updated' });
});

// Roblox reports the result of a /execute call
app.post('/execute_result', async (req, res) => {
  const { executionId, success, output, error } = req.body || {};
  if (executionId) await db.setExecuteResult(executionId, { success: !!success, output, error });
  res.json({ status: 'ok' });
});

// Roblox queries ban status for a user
app.get('/is_banned/:userId', async (req, res) => {
  res.json({ banned: await db.isBanned(req.params.userId) });
});

// Roblox can pull the full ban list (used to sync local cache on startup)
app.get('/get_bans', async (_req, res) => {
  res.json({ bans: await db.getBans() });
});

// Roblox can pull the whitelist
app.get('/get_whitelist', async (_req, res) => {
  res.json({ whitelist: await db.getWhitelist() });
});

// ─── BOT-FACING ENDPOINTS (called by the Discord bot commands) ──────

app.get('/servers', async (_req, res) => {
  res.json({ servers: await db.getServers() });
});

app.get('/banlist', async (_req, res) => {
  const bans = await db.getBans();
  res.json({
    bans: bans.map((b) => ({
      username: b.username,
      userId: b.userid,
      reason: b.reason,
      bannedBy: b.executor || 'System',
      type: b.banType,
    })),
  });
});

// Plain ID lists (for Roblox HttpService:JSONDecode of a flat list)
app.get(['/banlist-users', '/banlist.json'], async (_req, res) => {
  const bans = await db.getBans();
  res.json(bans.map((b) => Number(b.userid)).filter((n) => Number.isFinite(n)));
});

app.get(['/whitelist-users', '/whitelist.json'], async (_req, res) => {
  const wl = await db.getWhitelist();
  res.json(wl.map((id) => Number(id)).filter((n) => Number.isFinite(n)));
});

app.get('/fetchcloudbans', async (_req, res) => {
  const bans = await db.getBans();
  const cloudBans = bans
    .filter((b) => b.banType === 'permanent' || b.banType === 'cloud')
    .map((b) => ({ username: b.username, userId: b.userid, reason: b.reason, type: b.banType }));
  const asyncBans = bans
    .filter((b) => b.banType === 'async')
    .map((b) => ({ username: b.username, userId: b.userid, reason: b.reason }));
  res.json({ cloudBans, asyncBans });
});

app.get('/lookup/:userId', async (req, res) => {
  const userid = String(req.params.userId);
  const isBanned = await db.isBanned(userid);
  const wl = await db.getWhitelist();
  const isWhitelisted = wl.includes(userid);
  res.json({
    isBanned,
    isWhitelisted,
    warnings: 0,
    status: isBanned ? 'Banned' : 'Active',
  });
});

app.post('/pcban', async (req, res) => {
  const { target, reason, executor, username, displayName } = req.body || {};
  if (!target) return res.status(400).json({ error: 'Missing target' });
  await db.addBan({
    userid: String(target),
    username: username || `User_${target}`,
    display_name: displayName || username || `User_${target}`,
    reason: reason || '',
    banType: 'permanent',
    duration: -1,
    executor: executor || 'Bot',
    timestamp: Date.now(),
  });
  await pushCommand({ command: 'pcban', userid: String(target), reason, executor });
  res.json({ status: 'banned' });
});

app.post('/unpcban', async (req, res) => {
  const { target, executor } = req.body || {};
  if (!target) return res.status(400).json({ error: 'Missing target' });
  await db.removeBan(String(target));
  await pushCommand({ command: 'unpcban', userid: String(target), executor });
  res.json({ status: 'unbanned' });
});

app.post('/banasync', async (req, res) => {
  const { target, reason, executor, username, displayName } = req.body || {};
  if (!target) return res.status(400).json({ error: 'Missing target' });
  await db.addBan({
    userid: String(target),
    username: username || `User_${target}`,
    display_name: displayName || username || `User_${target}`,
    reason: reason || '',
    banType: 'async',
    duration: -1,
    executor: executor || 'Bot',
    timestamp: Date.now(),
  });
  await pushCommand({ command: 'banall', userid: String(target), reason, executor, username: username || '' });
  res.json({ status: 'banned' });
});

app.post('/unbanasync', async (req, res) => {
  const { target, executor } = req.body || {};
  if (!target) return res.status(400).json({ error: 'Missing target' });
  await db.removeBan(String(target));
  await pushCommand({ command: 'unbanall', userid: String(target), executor });
  res.json({ status: 'unbanned' });
});

app.get('/whitelist', async (_req, res) => {
  const entries = await db.getWhitelistFull();

  // Backfill any rows that don't yet have a username via Roblox API
  const missing = entries.filter((e) => !e.username).map((e) => e.userId);
  if (missing.length > 0) {
    const lookup = await lookupUsernames(missing);
    for (const e of entries) {
      const found = lookup.get(e.userId);
      if (found) {
        e.username = found.username;
        e.displayName = found.displayName;
        // Persist for next time
        db.updateWhitelistNames(e.userId, found.username, found.displayName).catch(() => {});
      }
    }
  }

  res.json({ whitelist: entries, count: entries.length });
});

app.post('/whitelist', async (req, res) => {
  const { target, username, displayName } = req.body || {};
  if (!target) return res.status(400).json({ error: 'Missing target' });
  await db.addWhitelist(String(target), username || '', displayName || '');
  await pushCommand({ command: 'whitelist', userid: String(target), executor: 'Discord Bot' });
  res.json({ status: 'added' });
});

app.post('/unwhitelist', async (req, res) => {
  const { target } = req.body || {};
  if (!target) return res.status(400).json({ error: 'Missing target' });
  await db.removeWhitelist(String(target));
  await pushCommand({ command: 'unwhitelist', userid: String(target), executor: 'Discord Bot' });
  res.json({ status: 'removed' });
});

app.post('/kick', async (req, res) => {
  const { target, reason, executor } = req.body || {};
  if (!target) return res.status(400).json({ error: 'Missing target' });
  await pushCommand({ command: 'kick', userid: String(target), reason, executor });
  res.json({ status: 'queued' });
});

app.post('/kickall', async (req, res) => {
  const { reason, executor } = req.body || {};
  const { count } = await db.getPlayerState();
  await pushCommand({ command: 'kickall', reason, executor });
  res.json({ status: 'queued', count: count || 0 });
});

app.post('/shutdown', async (req, res) => {
  const { executor } = req.body || {};
  await pushCommand({ command: 'shutdown', executor });
  res.json({ status: 'queued' });
});

app.post('/restart', async (req, res) => {
  const { executor } = req.body || {};
  await pushCommand({ command: 'restart', executor });
  res.json({ status: 'queued' });
});

app.post('/execute', async (req, res) => {
  const { code, executor } = req.body || {};
  if (!code) return res.json({ success: false, error: 'No code provided' });

  const executionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await pushCommand({ command: 'execute', code, executor, executionId });

  // Wait briefly for a result from Roblox via /execute_result
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const r = await db.takeExecuteResult(executionId);
    if (r) return res.json(r);
    await new Promise((r) => setTimeout(r, 300));
  }
  // Optimistic ack — Roblox will execute once it polls
  res.json({ success: true, output: 'Queued for execution' });
});

let dbReady = null;
function ensureDb() {
  if (!dbReady) dbReady = db.initDb();
  return dbReady;
}
// On Vercel, api/index.js awaits this before handling each request instead
// of calling start().
app.use((req, res, next) => {
  ensureDb().then(() => next()).catch(next);
});

async function start(port = 5000) {
  await ensureDb();
  return new Promise((resolve) => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`[server] listening on :${port}`);
      resolve();
    });
  });
}

module.exports = { app, start };
