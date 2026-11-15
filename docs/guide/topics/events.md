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
| `MessageReactionRemoveEmoji` | `reaction` |
| `MessagePollVoteAdd`, `MessagePollVoteRemove` | `answer`, `userId` |
| `InteractionCreate` | `interaction` |
| `GuildCreate`, `GuildDelete` | `guild` |
| `GuildUpdate` | `oldGuild`, `newGuild` |
| `GuildMemberAdd`, `GuildMemberRemove` | `member` |
| `GuildMemberUpdate` | `oldMember`, `newMember` |
| `GuildBanAdd`, `GuildBanRemove` | `ban` (partial: fetch it for the reason) |
| `GuildAuditLogEntryCreate` | `entry`, `guild` |
| `InviteCreate`, `InviteDelete` | `invite` |
| `WebhooksUpdate` | `channel` |
| `AutoModerationRuleCreate`, `AutoModerationRuleDelete` | `rule` |
| `AutoModerationRuleUpdate` | `oldRule`, `newRule` |
| `AutoModerationActionExecution` | `execution` |
| `ChannelCreate`, `ChannelDelete` | `channel` |
| `ChannelUpdate` | `oldChannel`, `newChannel` |
| `ChannelPinsUpdate` | `channel`, `date` |
| `GuildRoleCreate`, `GuildRoleDelete` | `role` |
| `GuildRoleUpdate` | `oldRole`, `newRole` |
| `GuildEmojiCreate`, `GuildEmojiDelete` | `emoji` |
| `GuildEmojiUpdate` | `oldEmoji`, `newEmoji` |
| `GuildStickerCreate`, `GuildStickerDelete` | `sticker` |
| `GuildStickerUpdate` | `oldSticker`, `newSticker` |
| `PresenceUpdate` | `oldPresence`, `newPresence` |
| `TypingStart` | `typing` |
| `VoiceStateUpdate` | `oldState`, `newState` |
| `GuildSoundboardSoundCreate`, `GuildSoundboardSoundDelete` | `sound` |
| `GuildSoundboardSoundUpdate` | `oldSound`, `newSound` |
| `VoiceChannelEffectSend` | `effect` (a soundboard sound played in a voice channel) |
| `VoiceServerUpdate` | `data` (the bot's voice join, from @bisim/voice) |
| `UserUpdate` | `oldUser`, `newUser` |
| `ShardReady`, `ShardResume`, `ShardReconnecting`, `ShardDisconnect`, `ShardError` | the connection's life |
| `Debug`, `Warn`, `Error`, `Raw` | diagnostics |

`ClientReady` is also emitted under its older name, `ready`, so both spellings work, and `WebhooksUpdate`
under the deprecated `webhookUpdate`.

Which of these the bot receives depends on its intents, as on Discord: see
[The gateway and intents](./gateway.md#intents).

## What is different on Bisim

- **`ClientReady` is built by bisim.js.** Bisim has no READY event; bisim.js loads every server, then emits
  `ClientReady` once. After a reconnect it emits `ShardResume` instead.
- **Server refreshes.** When Bisim asks bisim.js to load a server again (the bot's permissions changed),
  bisim.js compares the server before and after and emits what changed, `ChannelUpdate` and the role events
  among them. A channel made or deleted is emitted once, whether its event or the refresh comes first.
- **Audit log entries** have Discord's numbers: `entry.action === AuditLogEvent.MemberBanAdd` works, and
  Bisim's own name for the action is `entry.actionName`.
- **Never emitted**, because Bisim has no source for them: `GuildMembersChunk`, `GuildIntegrationsUpdate`,
  `GuildAvailable`, `GuildUnavailable`, `ApplicationCommandPermissionsUpdate`, `CacheSweep`, and every
  thread, stage, scheduled event and entitlement event.
- **Uncached messages and members.** An edit, delete or reaction on a message the bot has not cached, or a
  member it has not cached leaving, is emitted only when you enable the matching partial, as in discord.js:
  `new Client({ partials: [Partials.Message, Partials.GuildMember] })`. A member who leaves comes with their
  user, so even a partial member has `member.user`.

## Errors

When a handler throws, the error is yours to catch: wrap the body in `try` and `catch`, as in the command
handler. Internal problems bisim.js recovers from are reported as `Warn`, or as `Error` when you listen to
it, so a bot without an error listener does not crash.
