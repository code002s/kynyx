const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x00AAFF)
      .setTitle('Kynx Moderation System')
      .setDescription(
        '**Utility**\n' +
        '├─ `/ping` - Test bot latency\n' +
        '├─ `/servers` - List all servers\n' +
        '└─ `/lookup` - Look up player info\n\n' +
        '**Player Moderation**\n' +
        '├─ `/kick` - Kick a player\n' +
        '└─ `/kickall` - Kick all players\n\n' +
        '**Ban Management**\n' +
        '├─ `/pcban` - Permanent device ban\n' +
        '├─ `/unpcban` - Remove PC ban\n' +
        '├─ `/banasync` - Cross-server ban\n' +
        '├─ `/unbanasync` - Remove async ban\n' +
        '├─ `/banlist` - List all bans\n' +
        '└─ `/fetchcloudbans` - Fetch cloud bans\n\n' +
        '**Access Control**\n' +
        '├─ `/whitelist` - Add to whitelist\n' +
        '└─ `/unwhitelist` - Remove from whitelist\n\n' +
        '**Server Management**\n' +
        '├─ `/shutdown` - Shut down server\n' +
        '├─ `/restart` - Restart server\n' +
        '└─ `/execute` - Execute Lua code\n\n' +
        '**Bot Management**\n' +
        '└─ `/botshutdown` - Shut down bot'
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
