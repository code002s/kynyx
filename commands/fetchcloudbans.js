const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fetchcloudbans')
    .setDescription('Fetch all Roblox cloud bans and async bans'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const response = await axios.post(`${process.env.API_URL}/fetchcloudbans`, {
        executor: interaction.user.username
      });
      const data = response.data;

      const embed = new EmbedBuilder()
        .setColor(0x00AAFF)
        .setTitle('Cloud Bans & Async Bans')
        .setTimestamp();

      // Cloud Bans
      let cloudBansText = '';
      if (data.cloudBans && data.cloudBans.length > 0) {
        data.cloudBans.forEach((ban, index) => {
          cloudBansText += `**[${index + 1}]** ${ban.username}\n`;
          cloudBansText += `├─ ID: \`${ban.userId}\`\n`;
          cloudBansText += `├─ Reason: ${ban.reason}\n`;
          cloudBansText += `└─ Type: \`${ban.type}\`\n\n`;
        });
      } else {
        cloudBansText = 'No cloud bans';
      }

      // Async Bans
      let asyncBansText = '';
      if (data.asyncBans && data.asyncBans.length > 0) {
        data.asyncBans.forEach((ban, index) => {
          asyncBansText += `**[${index + 1}]** ${ban.username}\n`;
          asyncBansText += `├─ ID: \`${ban.userId}\`\n`;
          asyncBansText += `└─ Reason: ${ban.reason}\n\n`;
        });
      } else {
        asyncBansText = 'No async bans';
      }

      embed.addFields(
        { name: 'Cloud Bans', value: cloudBansText.substring(0, 1024), inline: false },
        { name: 'Async Bans', value: asyncBansText.substring(0, 1024), inline: false }
      );

      const cloudCount = data.cloudBans?.length || 0;
      const asyncCount = data.asyncBans?.length || 0;
      embed.setDescription(`**Total: ${cloudCount} cloud ban(s) + ${asyncCount} async ban(s)**`);

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
