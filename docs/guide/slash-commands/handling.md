# Handling commands

When a member runs a command, your bot receives an `interactionCreate` event. This page loads your command
files, routes each interaction to its command, and shows every way to answer.

## Loading the commands

```js
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('bisim.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Every .js file under commands/, one folder per category, exports { data, execute }.
function commandFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return commandFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

for (const file of commandFiles(path.join(__dirname, 'commands'))) {
  const command = require(file);
  if (command.data && typeof command.execute === 'function') client.commands.set(command.data.name, command);
  else console.warn(`Skipped ${file}: it does not export data and execute.`);
}
```

## Running them

```js
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return console.warn(`No handler for /${interaction.commandName}.`);

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`/${interaction.commandName} failed:`, error);
    const oops = { content: 'Something went wrong while running that command.', flags: MessageFlags.Ephemeral };
    await (interaction.replied || interaction.deferred ? interaction.followUp(oops) : interaction.reply(oops));
  }
});

client.login(process.env.BISIM_TOKEN);
```

## Answering

An interaction must be answered **once**, and within **15 minutes** everything else about it is finished.

### Reply

```js
await interaction.reply('Done!');
await interaction.reply({ content: 'Only you can see this.', flags: MessageFlags.Ephemeral });
await interaction.reply({ embeds: [embed], components: [row] });
```

`flags: MessageFlags.Ephemeral` (or the older `ephemeral: true`) shows the answer only to the person who ran
the command. Ephemeral messages never reach other members, and never reach your bot as `messageCreate`.

### Defer, then edit

If the work takes more than a moment, defer first. Members see that your bot is thinking:

```js
await interaction.deferReply(); // or deferReply({ flags: MessageFlags.Ephemeral })
const result = await somethingSlow();
await interaction.editReply(`Done: ${result}`);
```

### Follow up

After a reply or a deferral, send more messages about the same interaction:

```js
await interaction.reply('Working on it...');
await interaction.followUp('One more thing.');
```

After `deferReply()`, the first `followUp()` takes the place of the "thinking" message, as on Discord, and
keeps its visibility; later ones are new messages. Answers and followups take files, embeds and components
like `channel.send()`, and a poll in a new message: `reply({ poll })` or `followUp({ poll })`, never ephemeral,
sent on its own, and not as the followUp that fills a deferral.

### Fetch and delete

```js
const sent = await interaction.fetchReply(); // the answer as a Message
await interaction.deleteReply(); // removes it
```

`reply({ ..., fetchReply: true })` resolves with the reply as a `Message`, and
`reply({ ..., withResponse: true })` with an `InteractionCallbackResponse`.

## State

`interaction.replied` and `interaction.deferred` tell you what was done already. Answering twice throws a
`BisimjsError` with the code `InteractionAlreadyReplied`; editing before answering throws
`InteractionNotReplied`.
