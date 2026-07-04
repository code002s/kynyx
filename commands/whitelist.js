const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { resolveTarget } = require('../utils/roblox');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Add a player to the whitelist')
    .addStringOption(option =>
      option.setName('target')
        .setDescription('User ID or username')
        .setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getString('target');
    try {
      const resolved = await resolveTarget(target);
      const response = await axios.post(`${process.env.API_URL}/whitelist`, {
        target: resolved.userId,
        username: resolved.username,
        displayName: resolved.displayName,
      });

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Whitelist Added')
        .setDescription(
          `●  Username: ${resolved.username}\n` +
          `   ├─ UserId: ${resolved.userId}\n` +
          `   ├─ Action: Added to whitelist\n` +
          `   └─ Status: Success`
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