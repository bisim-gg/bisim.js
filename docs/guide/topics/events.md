# Event handling

The client is an event emitter. Bisim's events arrive with discord.js's names and arguments, so
`client.on(Events.MessageCreate, (message) => {})` works as you expect.

## One file per event

Just like commands, events can live in their own files:

```js
// events/ready.js
const { Events } = require('bisim.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`${client.user.tag} is online.`);
  },
};
```

```js
// events/interactionCreate.js
const { Events } = require('bisim.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    await interaction.client.commands.get(interaction.commandName)?.execute(interaction);
  },
};
```

```js
// index.js
const eventsDir = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsDir).filter((name) => name.endsWith('.js'))) {
  const { name, once, execute } = require(path.join(eventsDir, file));
  client[once ? 'once' : 'on'](name, (...args) => execute(...args));
}
```

## The events

| Event | Arguments |
| --- | --- |
| `ClientReady` | `client` |
| `MessageCreate` | `message` |
| `MessageUpdate` | `oldMessage`, `newMessage` |
| `MessageDelete` | `message` |
| `MessageBulkDelete` | `messages`, `channel` |
| `MessageReactionAdd`, `MessageReactionRemove` | `reaction`, `user`, `details` |
| `MessageReactionRemoveAll` | `message`, `reactions` |
| `MessagePollVoteAdd`, `MessagePollVoteRemove` | `answer`, `userId` |
| `InteractionCreate` | `interaction` |
| `GuildCreate`, `GuildDelete` | `guild` |
| `GuildUpdate` | `oldGuild`, `newGuild` |
| `GuildMemberAdd`, `GuildMemberRemove` | `member` |
| `GuildMemberUpdate` | `oldMember`, `newMember` |
| `ChannelCreate`, `ChannelDelete` | `channel` |
| `ChannelUpdate` | `oldChannel`, `newChannel` |
| `ChannelPinsUpdate` | `channel`, `date` |
| `GuildRoleCreate`, `GuildRoleDelete` | `role` |
| `GuildRoleUpdate` | `oldRole`, `newRole` |
| `GuildEmojiCreate`, `GuildEmojiDelete` | `emoji` |
| `GuildStickerCreate`, `GuildStickerDelete` | `sticker` |
| `PresenceUpdate` | `oldPresence`, `newPresence` |
| `TypingStart` | `typing` |
| `VoiceStateUpdate` | `oldState`, `newState` |
| `VoiceServerUpdate` | `data` (the bot's voice join, from @bisim/voice) |
| `UserUpdate` | `oldUser`, `newUser` |
| `ShardReady`, `ShardResume`, `ShardReconnecting`, `ShardDisconnect`, `ShardError` | the connection's life |
| `Debug`, `Warn`, `Error`, `Raw` | diagnostics |

`ClientReady` is also emitted under its older name, `ready`, so both spellings work.

## What is different on Bisim

- **`ClientReady` is built by bisim.js.** Bisim has no READY event; bisim.js loads every server, then emits
  `ClientReady` once. After a reconnect it emits `ShardResume` instead.
- **Channels are created and deleted** through server refreshes: bisim.js compares the server before and
  after and emits `ChannelCreate`, `ChannelUpdate` and `ChannelDelete`.
- **Never emitted**, because Bisim has no source for them: `GuildBanAdd`, `GuildBanRemove`, `InviteCreate`,
  `InviteDelete`, `GuildMembersChunk`, and every thread, stage, scheduled event and entitlement event.
- **Uncached messages.** An edit, delete or reaction on a message the bot has not cached is emitted only
  when you enable the matching partial, as in discord.js: `new Client({ partials: [Partials.Message] })`.

## Errors

When a handler throws, the error is yours to catch: wrap the body in `try` and `catch`, as in the command
handler. Internal problems bisim.js recovers from are reported as `Warn`, or as `Error` when you listen to
it, so a bot without an error listener does not crash.
