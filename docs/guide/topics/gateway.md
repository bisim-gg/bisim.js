# The gateway and intents

The gateway is the WebSocket connection Bisim pushes events through. bisim.js manages it for you; this page
explains what it does, so its behaviour makes sense.

## Connecting

When you call `client.login()`, bisim.js:

1. Checks the token and reads the bot's own user.
2. Asks Bisim for a short lived gateway pass, sending your intents with it, and connects with it. A new
   pass is fetched for every connection.
3. Sends heartbeats so Bisim shows the bot online. Their round trip time is `client.ws.ping`.
4. Loads every server the bot is in, with its channels, roles, emojis and voice states (and the member list
   with the `GuildMembers` intent), and joins each server's events.
5. Emits `ClientReady` once everything is in.

Events that arrive while the servers are still loading wait and are emitted right after `ClientReady`.

## Intents

Intents say which events the bot wants, as on Discord. bisim.js sends `client.options.intents` when it
connects, and Bisim delivers only the events they cover, among those the bot's permissions let it see.
Ask only for what the bot uses:

```js
const { Client, GatewayIntentBits } = require('bisim.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});
```

| Intent | Events |
| --- | --- |
| `Guilds` | server, channel and role changes, pins |
| `GuildMembers` (privileged) | members joining, changing and leaving |
| `GuildModeration` | bans and audit log entries |
| `GuildExpressions` | emojis, stickers and soundboard sounds |
| `GuildWebhooks` | `WebhooksUpdate` |
| `GuildInvites` | invites made and deleted |
| `GuildVoiceStates` | `VoiceStateUpdate` |
| `GuildPresences` (privileged) | `PresenceUpdate` |
| `GuildMessages`, `DirectMessages` | messages made, edited and deleted |
| `GuildMessageReactions`, `DirectMessageReactions` | reactions |
| `GuildMessageTyping`, `DirectMessageTyping` | `TypingStart` |
| `GuildMessagePolls`, `DirectMessagePolls` | poll votes |
| `MessageContent` (privileged) | the text, embeds, files, components and poll of messages |
| `AutoModerationConfiguration` | AutoMod rules made, changed and deleted |
| `AutoModerationExecution` | `AutoModerationActionExecution` |

`GuildScheduledEvents` and `GuildIntegrations` are accepted and bring nothing, since Bisim has neither.
Interactions always arrive, whatever the intents. The bot always hears about its own member and its own
voice state.

### Privileged intents

`GuildMembers`, `GuildPresences` and `MessageContent` are privileged. Switch each one you use on in the
Developer Portal: [bisim.gg/developers](https://bisim.gg/developers), your app, **Bot**, **Privileged
Gateway Intents**. Once the bot is in 100 servers or more, Bisim must also approve them; ask for it on the
same page.

A bot without `MessageContent` still gets its messages, but with `content` empty, and without embeds,
attachments, components and polls, except for its own messages, messages that mention it, and DMs.
Commands and buttons need no intent: interactions are always whole. `message.mentions` and
`message.member` work either way, since Bisim sends them apart from the text.

Without `GuildMembers` bisim.js does not load the member list on connect: the bot's own member is loaded,
and the members the bot meets (message authors, for example) are cached as they come. `guild.members.fetch()`
with an id or a `query` works; fetching every member needs the intent switched on and otherwise rejects with
`MissingIntent`.

Without `GuildPresences` no presences arrive, and `guild.presences.cache` stays empty.

### When the intents are refused

Bisim checks the intents when the bot connects, and refuses them by closing the connection, as Discord does:

- **4013**, an intent Discord does not define: `login()` rejects with a `BisimjsError` whose code is
  `InvalidIntents`.
- **4014**, a privileged intent that is not switched on (or, from 100 servers on, not approved):
  `login()` rejects with `DisallowedIntents`.

bisim.js never reconnects after either. If it happens on a later reconnect, the client emits
`ShardDisconnect` with the code and the error as `Error`, and stays disconnected.

```js
client.login(process.env.BISIM_TOKEN).catch((error) => {
  if (error.code === 'DisallowedIntents') console.error('Switch the intent on in the Developer Portal.');
  else throw error;
});
```

## Partials

Partials work as in discord.js. Without them, events about uncached messages, reactions and members are
skipped; with them, bisim.js emits a partial object you can `fetch()`:

```js
const { Client, GatewayIntentBits, Partials } = require('bisim.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
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

Emojis and voice states are loaded for every server, and the member list too when the client has the
`GuildMembers` intent. For very large servers you can turn parts of this off:

```js
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  bootstrap: { members: false, emojis: true, voiceStates: true, concurrency: 4 },
});
```

Without the member list, `guild.members.cache` starts with the bot alone and fills as members appear; fetch
them when you need them.

## Rate limits

Bisim allows each bot 600 requests a minute, and 5 messages every 5 seconds per channel. Every answer says
where the bot stands, with Discord's headers: `X-RateLimit-Limit`, `-Remaining`, `-Reset`, `-Reset-After`
and `-Bucket`. bisim.js keeps requests of one route in order, learns which bucket each route is in, and when a
bucket has nothing left it waits for the reset instead of sending. When Bisim still answers 429, it waits as
long as Bisim says, and pauses every route when the limit is the bot's whole budget. Server errors and network
failures are retried.

```js
client.rest.on('rateLimited', (info) => console.log(`${info.route}: waiting ${info.timeToReset}ms (${info.hash})`));
```

`rest.options.rejectOnRateLimit` makes a limited request fail with a `RateLimitError` instead of waiting.

## Sharding

Bisim has no sharding: one connection carries everything. The shard events (`ShardReady`, `ShardResume`,
`ShardReconnecting`, `ShardDisconnect`) still fire, always for shard 0, and `ShardingManager` does not exist.

## Debugging

```js
client.on(Events.Debug, console.log);
client.on(Events.Warn, console.warn);
client.on(Events.Raw, (packet) => console.log(packet.t));
```
