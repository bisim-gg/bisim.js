# Changelog

All notable changes to bisim.js are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-11-15

### Added

- Gateway intents work as on Discord: the client sends `intents` when it connects and Bisim delivers only the
  events they cover. A privileged intent (`GuildMembers`, `GuildPresences`, `MessageContent`) has to be switched
  on in the Developer Portal (bisim.gg/developers, your app, Bot, Privileged Gateway Intents). When Bisim refuses
  the intents, `login()` rejects with `InvalidIntents` (close code 4013) or `DisallowedIntents` (4014), and the
  client never reconnects after either; on a later reconnect it emits `shardDisconnect` with the code and the
  error instead.
- New events: `guildBanAdd`, `guildBanRemove`, `inviteCreate`, `inviteDelete`, `guildAuditLogEntryCreate`,
  `webhooksUpdate` (and the deprecated `webhookUpdate`), `autoModerationRuleCreate`, `autoModerationRuleUpdate`,
  `autoModerationRuleDelete`, `autoModerationActionExecution`, `emojiUpdate`, `stickerUpdate` and
  `messageReactionRemoveEmoji`, with `AutoModerationRule` and `AutoModerationActionExecution` and the AutoMod and
  `AuditLogEvent` enums.
- `channelCreate` and `channelDelete` come from Bisim's own events, once each, even though a server refresh follows
  them.
- `message.member` comes with the message, and `message.mentions` (users, roles, `@everyone`) from the lists Bisim
  sends, so both work without the member list and without the Message Content intent. The text is still read for
  mentions when a server sends no lists.
- `guildMemberRemove` for a member that was not cached (with `Partials.GuildMember`) has the user who left.
- The `MissingIntent` error: `guild.members.fetch()` for every member rejects with it when the app does not have
  the Server Members intent switched on, instead of with a bare 403.
- Files everywhere a message is sent or edited: `interaction.reply()`, `followUp()`, `editReply()` and `update()`,
  `webhook.send()` and `webhook.editMessage()` (and `WebhookClient`'s), and `message.edit()`. bisim.js uploads them
  with the interaction's or the webhook's token. In an edit, `attachments` is the list of files kept and `files`
  adds new ones, as on Discord; `message.removeAttachments()` drops them all.
- `attachment://name` in an embed's image, thumbnail, author icon and footer icon shows a file sent or kept with
  the same message. One that names no file of the message is still left out, with a warning once.
- A poll in an interaction answer: `reply({ poll })` and `followUp({ poll })`.
- `allowedMentions` (and the client's `allowedMentions` option as the default) is sent with every message,
  interaction answer, webhook message and edit, and Bisim honours it as Discord does.
- Message flags: `SuppressEmbeds` and `SuppressNotifications` on `channel.send()`, interaction answers and
  webhooks, `message.suppressEmbeds()`, and `flags` on edits (which change `SuppressEmbeds` only). `message.flags`
  is read from events too.
- Select menu default values: `setDefaultUsers()`, `addDefaultUsers()`, `setDefaultRoles()`, `addDefaultRoles()`,
  `setDefaultChannels()`, `addDefaultChannels()`, and `addDefaultValues()` / `setDefaultValues()` on
  `MentionableSelectMenuBuilder`; `component.defaultValues` reads them back.
- `reaction.remove()` removes every reaction of one emoji (`Routes.channelMessageReactionAll`).
- `guild.bans.bulkCreate(users, { deleteMessageSeconds, reason })`, resolving with `{ bannedUsers, failedUsers }`,
  and `Routes.guildBulkBan`.
- Renaming emoji and stickers: `emoji.edit({ name })`, `emoji.setName()`, `guild.emojis.edit()`,
  `sticker.edit({ name })` and `guild.stickers.edit()`. Emoji roles and sticker descriptions and tags still throw.
- A webhook's own messages: `fetchMessage()`, `editMessage()` and `deleteMessage()` on `Webhook` and
  `WebhookClient`, with the token alone.
- Pictures: `webhook.edit({ avatar })` and `channel.createWebhook({ name, avatar })` (`null` removes it), and the
  bot's own `client.user.setAvatar()`, `setBanner()` and `edit({ avatar, banner })`. A picture is a Buffer, a
  path, a URL or a `data:` URI.
- `voiceChannel.setStatus()` sets a voice channel's status line while the bot is in the call.
- `guild.soundboardSounds` (`GuildSoundboardSoundManager`: `fetch`, `create`, `edit`, `delete`) with
  `SoundboardSound`, and the events `guildSoundboardSoundCreate`, `guildSoundboardSoundUpdate`,
  `guildSoundboardSoundDelete` and `voiceChannelEffectSend` (a `VoiceChannelEffect` when a sound is played).
- `guild.autoModerationRules` (`AutoModerationRuleManager`: `fetch`, `create`, `edit`, `delete`) and the methods of
  `AutoModerationRule` (`edit`, `delete`, `setName`, `setKeywordFilter`, `setEnabled`, `setActions` and the rest),
  with Discord's trigger, preset and action numbers.
- `REST.uploadFilesTo()`, and the routes `interactionAttachments`, `webhookAttachments`, `webhookAvatar`,
  `currentUserAvatar`, `currentUserBanner`, `channelVoiceStatus`, `guildAutoModerationRules` and
  `guildAutoModerationRule`.

### Changed

- Without the `GuildMembers` intent the client no longer loads every server's member list when it connects, only
  the bot's own member; other members are cached as they appear (message authors, for example). Add
  `GuildMembers` to the intents, and switch it on, to keep the whole list.
- Without the `GuildPresences` intent no presences arrive, so a subscription to a server is no longer confirmed by
  its presence snapshot: it counts at once, and is tried again if the gateway refuses it.
- Without the `MessageContent` intent a message from another member arrives with empty `content` and without
  embeds, attachments, components and polls (as on Discord), except messages that mention the bot and DMs. A bot
  that reads message text needs the intent in its options and switched on.
- `GuildAuditLogsEntry.action` is Discord's `AuditLogEvent` number (it was Bisim's name, now in the new
  `actionName`), `actionType` is `Create`, `Update` or `Delete`, `targetType` uses discord.js's names (`User`,
  `Channel`...), `target` resolves cached channels, roles and the server, and `changes` lists what an update
  changed. `fetchAuditLogs({ type })` takes either the number or Bisim's name.
- A `GuildBan` from an event is partial (no `reason`): `fetch()` it for the rest.
- Rate limits follow Bisim's `X-RateLimit-Bucket` and reset headers: the routes Bisim names as one bucket share its
  count, and a request waits for the reset when its bucket has nothing left, instead of running into a 429.
  `rateLimited` reports the bucket as `hash` and Bisim's `X-RateLimit-Scope` as `scope`.
- Embeds show their pictures: `setImage()`, `setThumbnail()` and the `iconURL` of `setAuthor()` and `setFooter()`
  are sent instead of being kept on the builder, and an embed Bisim sends back has its `thumbnail` and its author
  and footer `iconURL` filled in. A picture is an `http` or `https` link, or `attachment://name` for a file of
  the same message (see Added); anything else is left out with a warning once, since Bisim would refuse the whole
  message for it. Needs the Bisim server of 2026-11-15 or later; an older one ignores the pictures.

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
