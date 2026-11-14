# Changelog

All notable changes to bisim.js are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/).

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
