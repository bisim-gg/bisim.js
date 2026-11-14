# FAQ

## How do I set the bot's status?

```js
client.user.setPresence({ activities: [{ name: 'with bisim.js' }], status: 'idle' });
client.user.setActivity('the server', { type: ActivityType.Watching });
client.user.setStatus('dnd');
```

## How do I send a message to a specific channel?

```js
const channel = client.channels.cache.get('1198765432109876543');
await channel.send('Hello!');
```

## How do I send a DM?

```js
await user.send('Hello!');
await member.send('Hello!');
```

Bisim lets a bot message someone who shares a server with it, when their privacy settings allow it.

## How do I mention someone?

Put the user, member, role or channel in a template string: `${user}` becomes `<@id>`. Or use the formatters:
`userMention(id)`, `roleMention(id)`, `channelMention(id)`.

## How do I get someone's avatar?

```js
const url = user.displayAvatarURL({ size: 256 });
```

## Why do I not need the Message Content intent?

Bisim has no intents. A bot sees the content of every message in channels it can read.

## My bot does not see a channel. Why?

A bot is an ordinary member: it sees what its roles allow. Give its role View Channel in that channel.

## My commands do not show up.

- Run the deploy script, and check it printed the number of commands.
- Server commands appear at once; check you used the right server id.
- `setDefaultMemberPermissions()` hides a command from members without those permissions.
- The member needs Use Application Commands in the channel.

## "The application did not respond"

Your bot must answer an interaction within three seconds. If the work takes longer, call `deferReply()`
first, then `editReply()` when you are done.

## How do I check which features are missing?

The [Moving from discord.js](./moving-from-discord-js.md) page lists them. Each one throws a
`BisimjsError` with the code `NotSupported`:

```js
const { BisimjsError, ErrorCodes } = require('bisim.js');

try {
  await message.startThread({ name: 'Discussion' });
} catch (error) {
  if (error instanceof BisimjsError && error.code === ErrorCodes.NotSupported) {
    await message.reply('Threads are not available here.');
  }
}
```

## How do I handle API errors?

```js
const { BisimAPIError } = require('bisim.js');

try {
  await member.kick();
} catch (error) {
  if (error instanceof BisimAPIError && error.status === 403) {
    console.log(`Missing permissions: ${error.message} (${error.code})`);
  }
}
```

## Can I run my bot against a local Bisim?

Yes. Point the client at it with `rest.api` and `ws.gateway`:

```js
new Client({ intents: [], rest: { api: 'http://localhost:3000/api' }, ws: { gateway: 'ws://localhost:4000/ws' } });
```

## Where is the full API?

In the [API reference](/api/index.html){target="_self"}, generated from the library's own documentation.
Bisim's REST API and webhooks are described at [docs.bisim.gg](https://docs.bisim.gg).
