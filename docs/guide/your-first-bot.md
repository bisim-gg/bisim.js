# Your first bot

Create `index.js` in your project folder:

```js
const { Client, Events, GatewayIntentBits } = require('bisim.js');

// One client per bot. The intents say which events it receives.
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Runs once, after every server has been loaded.
client.once(Events.ClientReady, (readyClient) => {
  console.log(`${readyClient.user.tag} is online in ${readyClient.guilds.cache.size} servers.`);
});

// A text command: "!ping" gets the gateway latency back.
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || message.content !== '!ping') return;
  await message.reply(`Pong! ${client.ws.ping} ms`);
});

// The token is read from the BISIM_TOKEN environment variable.
client.login(process.env.BISIM_TOKEN);
```

`MessageContent` is a privileged intent, needed here to read `!ping`: switch it on first in the Developer
Portal ([bisim.gg/developers](https://bisim.gg/developers), your app, **Bot**, **Privileged Gateway Intents**).

Run it:

```sh
node index.js
```

The console shows the bot's name and how many servers it is in. Type `!ping` in a channel the bot can see,
and it answers.

## What happened

- `new Client()` creates the client. `intents` is required, as in discord.js: `Guilds` for the servers,
  `GuildMessages` for messages in them, and `MessageContent` for their text. See
  [The gateway and intents](./topics/gateway.md#intents).
- `client.login()` checks the token, connects to Bisim's gateway, and loads every server the bot is in:
  channels, roles, emojis and voice states.
- `Events.ClientReady` fires once, when everything is loaded. Its argument is the client itself, ready to
  use: `readyClient.user` is the bot, `readyClient.guilds.cache` holds its servers.
- `Events.MessageCreate` fires for every message the bot can see, including its own. That is why the
  handler returns early for bots.

## Setting a status

```js
const { ActivityType } = require('bisim.js');

client.once(Events.ClientReady, (readyClient) => {
  readyClient.user.setPresence({
    activities: [{ name: 'the server', type: ActivityType.Watching }],
    status: 'online',
  });
});
```

`setActivity()` and `setStatus()` work as well. Bisim shows Playing, Listening, Watching, Competing and a
custom status (`ActivityType.Custom` with `state` set to your text).

## A local Bisim

Every address bisim.js uses can be changed, for example to point a bot at a Bisim running on your machine:

```js
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  rest: { api: 'http://localhost:3000/api' },
  ws: { gateway: 'ws://localhost:4000/ws' },
});
```

## Stopping

`client.destroy()` closes the connection; the process then exits on its own. Press <kbd>Ctrl</kbd>+<kbd>C</kbd>
to stop a running bot.

Next: [slash commands](./slash-commands/index.md).
