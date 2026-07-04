const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('execute')
    .setDescription('Execute code on the server')
    .addStringOption(option =>
      option.setName('code')
        .setDescription('Lua code to execute')
        .setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const code = interaction.options.getString('code');

    try {
      const response = await axios.post(`${process.env.API_URL}/execute`, {
        code,
        executor: interaction.user.username,
      }, { timeout: 15000 });
      const data = response.data;

      if (data.success) {
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('Code Executed')
          .setDescription(
            `● Code executed successfully.`
          )
          .addFields(
            { name: 'Code', value: `\`\`\`lua\n${code.substring(0, 500)}\n\`\`\``, inline: false }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('Execution Failed')
          .setDescription(`● Error: ${data.error || 'Unknown error'}.`)
          .addFields(
            { name: 'Code', value: `\`\`\`lua\n${code.substring(0, 1000)}\n\`\`\``, inline: false }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
      }
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