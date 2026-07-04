require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const { start: startServer } = require('./server');

const TOKEN = process.env.DISCORD_TOKEN || process.env.discord_token;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
const commandJSON = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd?.data?.name) {
    client.commands.set(cmd.data.name, cmd);
    if (cmd.data.toJSON) commandJSON.push(cmd.data.toJSON());
  }
}
console.log(`[bot] loaded ${client.commands.size} commands`);

client.once(Events.ClientReady, async (c) => {
  console.log(`[bot] logged in as ${c.user.tag}`);

  // Auto-register slash commands as guild commands in every connected guild
  // so changes appear instantly (global commands take up to 1 hour to propagate)
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);

    // Clear any global commands so they don't show up duplicated alongside guild commands
    try {
      await rest.put(Routes.applicationCommands(c.user.id), { body: [] });
      console.log('[bot] cleared global commands');
    } catch (e) {
      console.error('[bot] failed to clear global commands:', e.message);
    }

    const guilds = await c.guilds.fetch();
    for (const [id] of guilds) {
      try {
        await rest.put(Routes.applicationGuildCommands(c.user.id, id), { body: commandJSON });
        console.log(`[bot] registered ${commandJSON.length} commands to guild ${id}`);
      } catch (e) {
        console.error(`[bot] failed to register commands to guild ${id}:`, e.message);
      }
    }
  } catch (e) {
    console.error('[bot] command auto-deploy failed:', e.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[bot] error in /${interaction.commandName}:`, err);
    const msg = { content: `● Error: ${err.message || 'Unknown error'}`, ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

(async () => {
  // Set RUN_HTTP_SERVER=false if the API (server.js) is deployed separately,
  // e.g. on Vercel, and this process should only run the Discord bot.
  if (process.env.RUN_HTTP_SERVER !== 'false') {
    try {
      await startServer(Number(process.env.PORT) || 5000);
    } catch (e) {
      console.error('[server] failed to start:', e.message);
    }
  } else {
    console.log('[server] RUN_HTTP_SERVER=false — skipping local HTTP server (API runs elsewhere)');
  }

  if (!TOKEN) {
    console.warn('[bot] DISCORD_TOKEN not set — Discord bot will not connect. HTTP server is still running.');
    return;
  }
  try {
    await client.login(TOKEN);
  } catch (e) {
    console.error('[bot] login failed:', e.message);
  }
})();

process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
