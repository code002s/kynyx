const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banlist')
    .setDescription('List all active server bans'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const response = await axios.get(`${process.env.API_URL}/banlist`);
      const bans = response.data.bans;

      if (bans.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('Ban List')
          .setDescription('No active bans')
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      let description = '';
      bans.forEach((ban, index) => {
        description += `**[${index + 1}]** ${ban.username}\n`;
        description += `├─ User ID: \`${ban.userId}\`\n`;
        description += `├─ Reason: ${ban.reason}\n`;
        description += `└─ Banned By: ${ban.bannedBy}\n\n`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Ban List')
        .setDescription(description.substring(0, 4096))
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
