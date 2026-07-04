# Deployment Guide (updated)

## What was actually fixed

The old code kept the command queue, live player counts, connected-server
list, and `/execute` results in a plain in-memory JS object inside
`server.js`. That only works if the Discord bot and HTTP API run as one
never-restarting process. It's now moved into Postgres (`db.js`), so it
survives restarts and works correctly even across multiple serverless
instances. Nothing about your slash commands or Roblox script needs to
change — same endpoints, same request/response shapes.

The Discord gateway connection (`index.js`, via `discord.js`) still needs a
process that stays running 24/7 — that part of Discord's design hasn't
changed and no hosting fix can change it. You have two deployment options
now:

## Option A — Simplest: everything on Railway/Render (recommended)

Deploy the whole repo as one service. `index.js` starts both the Discord bot
and the HTTP API together, same as before, just now backed by Postgres.

1. Railway → **New Project → Deploy from GitHub repo** → pick your repo.
2. Add a **PostgreSQL** plugin (auto-fills `DATABASE_URL`).
3. Set env vars from `.env.example`: `DISCORD_TOKEN`, `CLIENT_ID`,
   `GUILD_ID`, `API_URL` (the domain Railway gives you), `GAME_API_KEY`
   (make up a random string). Leave `RUN_HTTP_SERVER` unset.
4. Start command: `npm start`. Deploy, then run `node deploy.js` once to
   register slash commands.

## Option B — Split: API on Vercel, bot on Railway

If you specifically want the HTTP API on Vercel:

**On Vercel** (this repo, as-is):
1. Import the GitHub repo. Root directory: `/` (no change needed).
2. Set env vars: `GAME_API_KEY`, `DATABASE_URL` (point at a Postgres
   instance — e.g. Vercel Postgres, Neon, or Railway's Postgres plugin).
3. Deploy. Vercel will build `api/index.js`, which exports the Express app
   from `server.js` — no `app.listen()` involved, so it runs correctly as a
   serverless function now.
4. Note the deployed URL, e.g. `https://your-app.vercel.app`.

**On Railway** (bot only, no HTTP server here):
1. New project from the same GitHub repo.
2. Env vars: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `DATABASE_URL` (same
   Postgres as the Vercel deployment), `API_URL` = your Vercel URL from
   above, and **`RUN_HTTP_SERVER=false`**.
3. Start command: `npm start`. Deploy, then run `node deploy.js` once.

Either option works — Option A is less to manage since it's one service.

## Security note

Your original archive contained `.env` files with a live Discord token and
other secrets, plus a local SQLite database. None of that is included in
this copy. Since that token was already exposed in an uploaded file,
regenerate it in the Discord Developer Portal before deploying either way.
