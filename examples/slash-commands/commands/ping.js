const { SlashCommandBuilder } = require('bisim.js');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Checks that the bot is awake'),
  async execute(interaction) {
    await interaction.reply(`Pong! (${interaction.client.ws.ping}ms)`);
  },
};
