# Creating slash commands

Slash commands are what members type after `/` in a channel. A command has a name, a description, and
optionally options, subcommands and permissions. You describe it with `SlashCommandBuilder`.

## A first command

```js
const { SlashCommandBuilder } = require('bisim.js');

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Checks that the bot is awake');
```

A command name is 1 to 32 lowercase letters, digits, `-` or `_`. The description is 1 to 100 characters.
`toJSON()` turns the builder into the JSON Bisim stores; you rarely call it yourself.

## One file per command

As your bot grows, keep each command in its own file with its `data` and an `execute` function, the way the
discord.js guide does:

```
my-bot/
├── commands/
│   ├── fun/
│   │   └── roll.js
│   └── info/
│       ├── ping.js
│       └── server.js
├── deploy-commands.js
└── index.js
```

```js
// commands/info/ping.js
const { SlashCommandBuilder } = require('bisim.js');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Checks that the bot is awake'),
  async execute(interaction) {
    await interaction.reply(`Pong! The gateway answers in ${interaction.client.ws.ping} ms.`);
  },
};
```

```js
// commands/info/server.js
const { SlashCommandBuilder } = require('bisim.js');

module.exports = {
  data: new SlashCommandBuilder().setName('server').setDescription('Shows a few facts about this server'),
  async execute(interaction) {
    const { name, memberCount, createdAt } = interaction.guild;
    await interaction.reply(`${name} has ${memberCount} members and was created on ${createdAt.toDateString()}.`);
  },
};
```

```js
// commands/fun/roll.js
const { SlashCommandBuilder } = require('bisim.js');

module.exports = {
  data: new SlashCommandBuilder().setName('roll').setDescription('Rolls a six sided die'),
  async execute(interaction) {
    const face = Math.floor(Math.random() * 6) + 1;
    await interaction.reply(`${interaction.user.displayName} rolled a ${face}.`);
  },
};
```

A command does nothing until it is **registered** with Bisim, and your bot needs code that **handles** it.
The next two pages do both: [registering commands](./registering.md) and
[handling commands](./handling.md).
