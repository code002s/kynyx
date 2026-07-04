require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN || process.env.discord_token;
let CLIENT_ID = process.env.CLIENT_ID || process.env.client_id;
const GUILD_ID = process.env.GUILD_ID || process.env.guild_id;

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN in environment.');
  process.exit(1);
}

// Derive client/application ID from the bot token if not provided
if (!CLIENT_ID) {
  try {
    const firstPart = TOKEN.split('.')[0];
    CLIENT_ID = Buffer.from(firstPart, 'base64').toString('utf8');
    console.log(`Derived CLIENT_ID from token: ${CLIENT_ID}`);
  } catch (e) {
    console.error('Failed to derive CLIENT_ID from token. Please set CLIENT_ID env var.');
    process.exit(1);
  }
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd?.data?.toJSON) commands.push(cmd.data.toJSON());
}

(async () => {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    if (GUILD_ID) {
      console.log(`Registering ${commands.length} guild commands to ${GUILD_ID}...`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    } else {
      console.log(`Registering ${commands.length} global commands...`);
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    }
    console.log('Slash commands deployed.');
  } catch (e) {
    console.error('Deploy failed:', e);
    process.exit(1);
  }
})();
