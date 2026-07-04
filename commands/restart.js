const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Restart the server'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const response = await axios.post(`${process.env.API_URL}/restart`, {
        executor: interaction.user.username,
      });

      const embed = new EmbedBuilder()
      .setColor(0xFFAA00)
      .setTitle('Server Restart')
      .setDescription(
        `● Server is restarting...\n` +
        `   ├─ Restarting in 5 seconds...\n`
      )
      .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Error')
        .setDescription(`\`\`\`${error.response?.data?.error || error.message}\`\`\``)
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};