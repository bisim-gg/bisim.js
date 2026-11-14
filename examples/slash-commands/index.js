// A slash command bot laid out like the discord.js guide's: each command lives in its own file in ./commands.
// Register them first with `node deploy-commands.js`, then run `node index.js`.
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('bisim.js');
const { api, gateway, token } = require('./config.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  rest: api ? { api } : undefined,
  ws: gateway ? { gateway } : undefined,
});

// name -> { data, execute }
client.commands = new Collection(
  fs
    .readdirSync(path.join(__dirname, 'commands'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => require(path.join(__dirname, 'commands', file)))
    .map((command) => [command.data.name, command]),
);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`${readyClient.user.tag} is online in ${readyClient.guilds.cache.size} servers.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return console.warn(`No handler for ${interaction.commandName}.`);
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`${interaction.commandName} failed:`, error);
    const oops = { content: 'Something went wrong while running that command.', flags: MessageFlags.Ephemeral };
    await (interaction.replied || interaction.deferred ? interaction.followUp(oops) : interaction.reply(oops));
  }
});

client.login(token);
