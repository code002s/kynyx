# kynxyy bot

Discord + Roblox moderation bot. Built with Node.js (discord.js v14).

## Architecture

- **`index.js`** — main entry; starts the Express HTTP server (port 5000) and logs the Discord bot in.
- **`deploy.js`** — registers slash commands with Discord. Run with `node deploy.js` after adding/removing commands.
- **`server.js`** — Express HTTP API used by the Roblox in-game script (queue commands, report player counts, sync bans/whitelist/blacklist/etc.).
- **`db.js`** — Postgres helpers (uses `DATABASE_URL`). Tables: `bans`, `whitelist`, `blacklist`, `suspicious_accounts`, `settings`.
- **`commands/`** — one slash command per file. Auto-loaded by `index.js` and `deploy.js`.
- **`utils/api.js`** — wrapper for posting to the local HTTP API.
- **`utils/roblox.js`** — resolves usernames/userIds via the public Roblox API.

## Slash commands

Utility: `/ping`, `/servers`, `/help`
Moderation: `/kick`, `/kickall`
Bans: `/pcban`, `/unpcban`, `/banlist`, `/banasync`, `/unbanasync`
Access: `/whitelist`, `/unwhitelist`
Server: `/shutdown`, `/restart`, `/execute`

## Required environment variables

Set these in Replit Secrets:

- `DISCORD_TOKEN` — bot token
- `CLIENT_ID` — Discord application/client ID
- `GUILD_ID` — (optional) restrict slash commands to one guild for instant updates
- `API_URL` — base URL of this server (e.g. the Replit dev domain or production URL)
- `SERVER_API_KEY` — shared secret between bot and HTTP API
- `GAME_API_KEY` — shared secret used by the Roblox game script
- `DATABASE_URL` — Postgres connection string
- `PORT` — defaults to 5000

## Deployment

Configured as a Reserved VM with `npm install` build and `node index.js` run command. Discord bots need an always-on process, so VM is the correct target (autoscale would put the bot to sleep).
