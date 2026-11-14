# bisim.js

[![npm](https://img.shields.io/npm/v/bisim.js.svg)](https://www.npmjs.com/package/bisim.js)
[![CI](https://github.com/bisim-gg/bisim.js/actions/workflows/ci.yml/badge.svg)](https://github.com/bisim-gg/bisim.js/actions/workflows/ci.yml)

The official Node.js library for [Bisim](https://bisim.gg) bots. It is written the discord.js v14 way: the
same classes, methods, events, builders and options, so a discord.js bot moves to Bisim by changing the
import and the token.

```diff
- const { Client, Events, GatewayIntentBits } = require('discord.js');
+ const { Client, Events, GatewayIntentBits } = require('bisim.js');
```

## Install

```sh
npm install bisim.js
```

Node.js 18 or newer. ESM and CommonJS are both supported, and the types are included.

## A bot in twenty lines

```js
const { Client, Events, GatewayIntentBits, SlashCommandBuilder } = require('bisim.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const ping = new SlashCommandBuilder().setName('ping').setDescription('Checks that the bot is awake');

client.once(Events.ClientReady, async (readyClient) => {
  await readyClient.application.commands.set([ping]);
  console.log(`${readyClient.user.tag} is online.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'ping') return;
  await interaction.reply(`Pong! ${client.ws.ping}ms`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.content === '!hello') await message.reply(`Hello, ${message.author.displayName}!`);
});

client.login(process.env.BISIM_TOKEN);
```

Create the bot in Bisim under Settings, Applications, add it to a server, and put its token in
`BISIM_TOKEN`. More complete bots are in [`examples/`](./examples): a slash command bot laid out like the
discord.js guide, a bot with buttons and a select menu, and a prefix command bot.

## Documentation

- **Guide:** [English](https://bisim-gg.github.io/bisim.js/guide/) and
  [فارسی](https://bisim-gg.github.io/bisim.js/fa/guide/), from your first bot to slash commands, buttons,
  modals, collectors and receiving interactions over HTTP.
- **API reference:** [every class, method and event](https://bisim-gg.github.io/bisim.js/api/index.html).
- **Moving from discord.js:** [what changes, what Bisim does not have, and what throws](https://bisim-gg.github.io/bisim.js/guide/moving-from-discord-js.html).
- **Voice:** [joining voice channels, playing and receiving audio](https://bisim-gg.github.io/bisim.js/guide/voice/)
  with [@bisim/voice](https://github.com/bisim-gg/voice).
- **Bisim developer docs:** [docs.bisim.gg](https://docs.bisim.gg), for webhooks, bots and the HTTP API
  underneath this library.

The same site is also served at [docs.bisim.gg/js](https://docs.bisim.gg/js/).

## Coming from discord.js

Most bots run unchanged. The short version:

- **Names.** Only the word "Discord" changes: `DiscordAPIError` is `BisimAPIError`, `DiscordjsError` is
  `BisimjsError`, `discordSort` is `bisimSort`.
- **Intents** are accepted and ignored. A bot receives what its permissions let it see.
- **Voice** is the package [`@bisim/voice`](https://www.npmjs.com/package/@bisim/voice), in place of
  `@discordjs/voice`, with the same API: `adapterCreator: guild.voiceAdapterCreator` works as before.
- **Not on Bisim:** threads, stage and forum channels, scheduled events,
  sharding, sticker packs, per command permissions. Calling these throws a `BisimjsError` that says so;
  nothing fails silently.

The [full page](https://bisim-gg.github.io/bisim.js/guide/moving-from-discord-js.html) covers embeds, files,
error codes and how bisim.js loads your servers at startup.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) first, and follow the
[code of conduct](./CODE_OF_CONDUCT.md). Report security problems privately as described in
[SECURITY.md](./SECURITY.md).

```sh
npm install
npm test             # vitest, against a fake gateway and recorded responses
npm run build        # ESM, CommonJS and type declarations in dist/
npm run docs:build   # the guide and the API reference
```

## License

MIT, Copyright (c) 2026 Bisim. See [LICENSE](./LICENSE).
