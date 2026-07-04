const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shutdown')
    .setDescription('Shut down the server'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const response = await axios.post(`${process.env.API_URL}/shutdown`, {
        executor: interaction.user.username,
      });

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Server Shutdown')
        .setDescription(
          `● Server is shutting down...\n` +
          `  └─ Shutdown complete.`
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