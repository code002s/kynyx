const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Test bot latency'),
  async execute(interaction) {
    const latency = Date.now() - interaction.createdTimestamp;

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Pong!')
      .setDescription(
        `● Pong!\n` +
        `   └─ Latency: ${Math.abs(latency)}ms`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};