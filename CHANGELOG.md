# Changelog

All notable changes to bisim.js are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/).

## [Unreleased]

### Changed

- Embeds show their pictures: `setImage()`, `setThumbnail()` and the `iconURL` of `setAuthor()` and `setFooter()`
  are sent instead of being kept on the builder, and an embed Bisim sends back has its `thumbnail` and its author
  and footer `iconURL` filled in. A picture must be an `http` or `https` link; Discord's `attachment://` is left out
  with a warning once, since Bisim would refuse the whole message for it. Needs the Bisim server of 2026-11-15 or
  later; an older one ignores the pictures.

## [0.2.0] - 2026-11-14

Voice: a bot joins voice channels with the new package [@bisim/voice](https://github.com/bisim-gg/voice), the
counterpart of `@discordjs/voice`.

### Added

- `guild.voiceAdapterCreator`, the adapter @bisim/voice's `joinVoiceChannel` takes as `adapterCreator`, as in
  discord.js. It joins, leaves and changes the bot's own mute and deafen over Bisim's API, follows a moderator's
  move of the bot (`VOICE_MOVE`), and passes on the bot's own voice state.
- `client.voice` (`ClientVoiceManager`) with the adapters of every server; they end with `client.destroy()` and
  when the bot leaves a server.
- `VoiceChannel.sendSoundboardSound()` plays one of the server's soundboard sounds while the bot is connected.
- The `voiceServerUpdate` event, with `{ guildId, endpoint, token }`.
- `Routes.channelVoiceJoin`, `channelVoiceLeave`, `channelVoiceSelfState` and `sendSoundboardSound`.

### Changed

- `VoiceChannel.joinable` and `speakable` follow the bot's permissions (Connect and Speak, and a timeout) instead
  of always being `false`.
- Server mute, deafen, move and disconnect on the bot's own voice state no longer throw; Bisim checks the
  permissions as for anyone else.

## [0.1.0] - 2026-11-14

The first release: the core of a discord.js v14 style library for Bisim.

### Added

- `Client` with discord.js's options (`intents` and `partials` accepted, `presence`, `rest`, `ws`), `login`,
  `destroy`, `isReady`, `generateInvite` (Bisim's install link), `fetchInvite`, `fetchWebhook`, and
  `handleInteraction` for bots with an Interactions URL.
- The gateway: a pass per connection, heartbeats with a measured `client.ws.ping`, reconnects with jittered
  backoff and at once on a drain, and a built READY: every server is loaded and subscribed before
  `ClientReady`. `GUILD_RESYNC` is diffed into channel, role and server events, `GUILD_JOIN` becomes
  `guildCreate`, and a server that is gone becomes `guildDelete`.
- discord.js's events with discord.js's arguments, from messages, edits and deletes to reactions, members,
  roles, presences, typing, voice states, emojis, stickers, polls, pins and interactions.
- `REST` and `Routes` with Bisim's paths under discord.js's names, a queue per route, Bisim's rate limits
  (per route and global), retries on server and network errors, `rateLimited` and `response` events, and
  file uploads through Bisim's presigned flow. The discord.js guide's deploy script works as written.
- Structures and managers with caches: users, the client user and its presence, servers, members and their
  roles, roles, text, voice and category channels, DMs, messages with mentions, embeds, attachments,
  components, reactions and polls, permission overwrites, invites, bans, emojis, stickers, webhooks (and
  `WebhookClient`), voice states with moderation, the application and its commands, and the audit log.
- Slash commands, context menu commands, buttons, select menus, modals and autocomplete, with every
  `is...()` guard, the option resolver, and `reply`, `deferReply`, `editReply`, `deleteReply`,
  `fetchReply`, `followUp`, `update`, `deferUpdate`, `showModal` and `respond`.
- The builders: `SlashCommandBuilder` (every option type, subcommands, groups, Persian and English
  translations), `ContextMenuCommandBuilder`, `EmbedBuilder`, `ActionRowBuilder`, `ButtonBuilder`, the five
  select menu builders, `ModalBuilder`, `TextInputBuilder` and `AttachmentBuilder`, all producing Bisim's
  JSON.
- Collectors: `createMessageComponentCollector`, `awaitMessageComponent`, `awaitModalSubmit`,
  `createMessageCollector`, `awaitMessages`, `createReactionCollector` and `awaitReactions`.
- `Collection`, `BitField`, `PermissionsBitField` with Discord's bit numbers, `IntentsBitField`, the enums,
  `Colors`, `Events`, the markdown formatters, `SnowflakeUtil` with Bisim's epoch, and the error classes.
- `verifyKey` for Interactions URL signatures.
