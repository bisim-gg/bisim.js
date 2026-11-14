// Buttons and a select menu, answered from interactionCreate without collectors.
// Register the /vote command once with: node examples/buttons.js --deploy
//   BISIM_TOKEN, BISIM_CLIENT_ID and BISIM_GUILD_ID come from the environment (BISIM_API / BISIM_WS for a local Bisim).
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('bisim.js');

const { BISIM_TOKEN: token, BISIM_CLIENT_ID: clientId, BISIM_GUILD_ID: guildId, BISIM_API: api, BISIM_WS: gateway } = process.env;

const command = new SlashCommandBuilder().setName('vote').setDescription('Start a quick vote');
const votes = new Map();

async function deploy() {
  const rest = new REST(api ? { api } : {}).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [command.toJSON()] });
  console.log('Registered /vote');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  rest: api ? { api } : undefined,
  ws: gateway ? { gateway } : undefined,
});

client.once(Events.ClientReady, (readyClient) => console.log(`Ready as ${readyClient.user.tag}`));

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'vote') {
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('vote:yes').setLabel('Yes').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('vote:no').setLabel('No').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setLabel('About Bisim').setStyle(ButtonStyle.Link).setURL('https://bisim.gg'),
    );
    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('vote:mood')
        .setPlaceholder('How do you feel?')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Happy').setValue('happy').setEmoji('😀'),
          new StringSelectMenuOptionBuilder().setLabel('Tired').setValue('tired').setEmoji('😴'),
        ),
    );
    await interaction.reply({ content: 'Do you like buttons?', components: [buttons, menu] });
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('vote:')) {
    votes.set(interaction.user.id, interaction.customId.slice('vote:'.length));
    const yes = [...votes.values()].filter((value) => value === 'yes').length;
    const no = votes.size - yes;
    await interaction.update({ content: `Do you like buttons? Yes: ${yes}, No: ${no}` });
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'vote:mood') {
    await interaction.reply({ content: `You feel ${interaction.values[0]}.`, flags: MessageFlags.Ephemeral });
  }
});

if (process.argv.includes('--deploy')) deploy().catch(console.error);
else client.login(token);
