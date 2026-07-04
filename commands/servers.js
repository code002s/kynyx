const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servers')
    .setDescription('List all active server player counts'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const response = await axios.get(`${process.env.API_URL}/servers`);
      const servers = response.data?.servers || [];

      if (!servers || servers.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFFAA00)
          .setTitle('Server List')
          .setDescription('**No active servers found**')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      let description = '';
      servers.forEach((server, index) => {
        description += `● Server #${index + 1}\n`;
        description += `   ├─ JobID: \`${server.jobId || 'Unknown'}\`\n`;
        description += `   ├─ PlaceID: \`${server.placeId || 'Unknown'}\`\n`;
        description += `   ├─ Players: **${server.players || 0}**\n`;
        description += `   └─ Last Update: <t:${Math.floor(server.lastUpdate / 1000)}:R>\n`;
        if (index < servers.length - 1) description += '\n';
      });

      const embed = new EmbedBuilder()
        .setColor(0x00AAFF)
        .setTitle('Active Servers')
        .setDescription(description)
        .setFooter({ text: `Total: ${servers.length} server(s)` })
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