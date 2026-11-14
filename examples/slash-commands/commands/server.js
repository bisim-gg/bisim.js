const { EmbedBuilder, SlashCommandBuilder, time } = require('bisim.js');

module.exports = {
  data: new SlashCommandBuilder().setName('server').setDescription('Shows a few facts about this server'),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply('Run this in a server.');
      return;
    }
    const { guild } = interaction;
    const card = new EmbedBuilder()
      .setTitle(guild.name)
      .setColor(0x2ecc71)
      .addFields(
        { name: 'Members', value: String(guild.memberCount), inline: true },
        { name: 'Channels', value: String(guild.channels.cache.size), inline: true },
        { name: 'Created', value: time(guild.createdAt, 'R'), inline: true },
      )
      .setFooter({ text: `Asked by ${interaction.user.displayName}` })
      .setTimestamp();
    await interaction.reply({ embeds: [card] });
  },
};
