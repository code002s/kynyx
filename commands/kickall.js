const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kickall')
    .setDescription('Kick all players from the server')
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for mass kick')
        .setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply();
    const reason = interaction.options.getString('reason') || 'Server maintenance';

    try {
      const response = await axios.post(`${process.env.API_URL}/kickall`, {
        reason,
        executor: interaction.user.username,
      });
      const data = response.data;

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Mass Kick')
        .setDescription(
          `● Kicked all players\n` +
          `   ├─ Reason: ${reason}\n` +
          `   └─ Count: ${data.count || 0} players`
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