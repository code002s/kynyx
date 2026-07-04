const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { resolveTarget } = require('../utils/roblox');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lookup')
    .setDescription('Look up player information')
    .addStringOption(option =>
      option.setName('target')
        .setDescription('User ID or username')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getString('target');

    try {
      const resolved = await resolveTarget(target);

      if (!resolved || !resolved.userId) {
        throw new Error('Failed to resolve user');
      }

      const userId = resolved.userId;
      const username = resolved.username || 'Unknown';
      const displayName = resolved.displayName || username;

      let created = 'N/A';

      try {
        const userResponse = await axios.get(
          `https://users.roblox.com/v1/users/${userId}`,
          { timeout: 5000 }
        );

        if (userResponse?.data?.created) {
          created = new Date(userResponse.data.created).toLocaleString();
        }
      } catch (err) {
        console.error('Roblox API error:', err.message);
      }

      let data = {};
      try {
        const response = await axios.get(
          `${process.env.API_URL}/lookup/${userId}`,
          { timeout: 5000 }
        );
        data = response.data || {};
      } catch (err) {
        console.error('Custom API error:', err.message);
      }

      const embed = new EmbedBuilder()
        .setColor(0x00AAFF)
        .setTitle('Player Information')
        .setDescription(
          `**${displayName}** (@${username})\n\n` +
          `├─ User ID: \`${userId}\`\n` +
          `├─ Profile: [View](https://www.roblox.com/users/${userId})\n` +
          `├─ Created: ${created}\n` +
          `├─ Banned: ${data.isBanned ? '`Yes`' : '`No`'}\n` +
          `├─ Whitelisted: ${data.isWhitelisted ? '`Yes`' : '`No`'}\n` +
          `├─ Warnings: \`${data.warnings ?? 0}\`\n` +
          `└─ Status: \`${data.status ?? 'Active'}\``
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error(error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Error')
        .setDescription(`\`\`\`${error.response?.data?.error || error.message}\`\`\``)
        .setTimestamp();

      try {
        await interaction.editReply({ embeds: [errorEmbed] });
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError.message);
      }
    }
  },
};
