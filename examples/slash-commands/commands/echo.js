const { MessageFlags, SlashCommandBuilder } = require('bisim.js');

module.exports = {
  data: new SlashCommandBuilder() // /echo input [ephemeral]
    .setName('echo')
    .setDescription('Says your text back')
    .setDescriptionLocalizations({ fa: 'متن شما را تکرار می‌کند' })
    .addStringOption((option) => option.setName('input').setDescription('What to echo').setRequired(true))
    .addBooleanOption((option) => option.setName('ephemeral').setDescription('Only you see the answer')),
  async execute(interaction) {
    const input = interaction.options.getString('input', true);
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;
    await interaction.reply({ content: input, flags: ephemeral ? MessageFlags.Ephemeral : undefined });
  },
};
