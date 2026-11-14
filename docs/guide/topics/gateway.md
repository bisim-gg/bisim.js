# The gateway and intents

The gateway is the WebSocket connection Bisim pushes events through. bisim.js manages it for you; this page
explains what it does, so its behaviour makes sense.

## Connecting

When you call `client.login()`, bisim.js:

1. Checks the token and reads the bot's own user.
2. Asks Bisim for a short lived gateway pass and connects with it. A new pass is fetched for every
   connection.
3. Sends heartbeats so Bisim shows the bot online. Their round trip time is `client.ws.ping`.
4. Loads every server the bot is in, with its channels, roles, members, emojis and voice states, and joins
   each server's events.
5. Emits `ClientReady` once everything is in.

Events that arrive while the servers are still loading wait and are emitted right after `ClientReady`.

## Intents

Bisim has no intents. `intents` is still required in the client options, so discord.js code runs
unchanged, and `client.options.intents` reads back what you passed, but it changes nothing: a bot
receives every event its permissions let it see. Message content is always included.

## Partials

Partials work as in discord.js. Without them, events about uncached messages, reactions and members are
skipped; with them, bisim.js emits a partial object you can `fetch()`:

```js
const { Client, Partials } = require('bisim.js');

const client = new Client({
  intents: [],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
```

## Reconnecting

Connections drop: a network hiccup, or Bisim restarting its gateway. bisim.js reconnects by itself, with a
growing, randomised wait between attempts (from one to thirty seconds), or at once when the gateway asks
it to. Bisim has no resume, so after reconnecting bisim.js loads the servers again, emits the changes it
finds (`GuildCreate`, `GuildDelete`, `ChannelCreate`, `GuildRoleUpdate` and so on) and then `ShardResume`.

When Bisim drops the bot's subscription to one server (its permissions or channels changed), bisim.js
refreshes that server, emits what changed, and subscribes again. A server the bot was removed from emits
`GuildDelete`.

## What is loaded on connect

The member list, emojis and voice states are loaded for every server. For very large servers you can turn
parts of this off:

```js
const client = new Client({
  intents: [],
  bootstrap: { members: false, emojis: true, voiceStates: true, concurrency: 4 },
});
```

Without the member list, `guild.members.cache` starts empty and fills as members appear; fetch them when you
need them.

## Rate limits

Bisim allows each bot 600 requests a minute, and 5 messages every 5 seconds per channel. bisim.js queues
requests per route, waits when Bisim says to, and retries server errors and network failures. Listen to
`client.rest.on('rateLimited', (info) => {})` to see it happen.

## Sharding

Bisim has no sharding: one connection carries everything. The shard events (`ShardReady`, `ShardResume`,
`ShardReconnecting`, `ShardDisconnect`) still fire, always for shard 0, and `ShardingManager` does not exist.

## Debugging

```js
client.on(Events.Debug, console.log);
client.on(Events.Warn, console.warn);
client.on(Events.Raw, (packet) => console.log(packet.t));
```
