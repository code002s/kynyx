const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botshutdown')
    .setDescription('Shut down the Discord bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Bot Shutdown')
      .setDescription('Discord bot is shutting down...')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    console.log('Bot shutdown requested by', interaction.user.tag);

    setTimeout(() => {
      process.exit(0);
    }, 1000);
  },
};
