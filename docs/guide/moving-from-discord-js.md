# Moving from discord.js

bisim.js follows discord.js v14 closely, so most bots move by changing two things.

## The two changes

1. The import:

   ```diff
   - const { Client, Events, GatewayIntentBits } = require('discord.js');
   + const { Client, Events, GatewayIntentBits } = require('bisim.js');
   ```

2. The token: create an application in the Developer Portal (**Settings**, **Developer Portal** in Bisim, or
   [bisim.gg/developers](https://bisim.gg/developers)) and use its token. Register your commands again with the
   deploy script; Bisim keeps its own command list.

## The one renaming rule

Names are discord.js's names. Only the word "Discord" becomes "Bisim":

| discord.js | bisim.js |
| --- | --- |
| `DiscordAPIError` | `BisimAPIError` |
| `DiscordjsError`, `DiscordjsTypeError`, `DiscordjsRangeError` | `BisimjsError`, `BisimjsTypeError`, `BisimjsRangeError` |
| `DiscordjsErrorCodes` | `ErrorCodes` |
| `discordSort` | `bisimSort` |
| `DiscordSnowflake` | `BisimSnowflake` (and `SnowflakeUtil`, with Bisim's epoch) |
| `DISCORD_TOKEN` read by `login()` | `BISIM_TOKEN` |

Everything else keeps its name: `Client`, `Events`, `SlashCommandBuilder`, `EmbedBuilder`, `PermissionFlagsBits`,
`Collection` and the rest.

## Not on Bisim

These do not exist on Bisim. bisim.js never ignores them silently: using them throws a `BisimjsError` whose
code is `NotSupported` and whose message names the feature.

| Feature | What throws |
| --- | --- |
| Threads | `Routes.threads()`, `message.startThread()`, `channel.threads` |
| Stage channels | `voiceState.setRequestToSpeak()`, `setSuppressed()`, `guild.stageInstances` |
| Forum and media channels, announcement channels | `message.crosspost()`, `guild.channels.addFollower()`, `textChannel.setType()` |
| Scheduled events | `guild.scheduledEvents` |
| Sharding | `ShardingManager` does not exist; `shards` other than 0 throw `ClientInvalidProvidedShards` |
| Command permissions | `command.permissions`, `commands.permissions.set()` |
| Sticker packs, SKUs, entitlements, premium buttons | `client.fetchStickerPacks()`, `application.fetchSKUs()`, `ButtonStyle.Premium` |
| Server widgets, previews, onboarding, welcome screens, integrations | the matching `guild.fetch...()` methods |
| Server icons, banners and splashes through the API | `guild.setIcon()`, `guild.setBanner()`, `guild.setSplash()` |
| Labels in modals | `addLabelComponents()` |
| Emoji limited to roles, sticker descriptions and tags | `emoji.edit({ roles })`, `sticker.edit({ description, tags })` |
| Custom emoji on soundboard sounds | `guild.soundboardSounds.create({ emojiId })` |
| AutoMod mention raid protection, blocking member interactions, changing a rule's event type | `setMentionRaidProtectionEnabled(true)`, `AutoModerationActionType.BlockMemberInteraction`, `rule.setEventType()` |
| Changing a channel's type, bitrate, user limit or region | the matching `channel.set...()` methods |

## Intents

Intents work as on Discord: the bot receives the events its intents cover, and the privileged ones
(`GuildMembers`, `GuildPresences`, `MessageContent`) must be switched on in the Developer Portal
([bisim.gg/developers](https://bisim.gg/developers), your app, **Bot**, **Privileged Gateway Intents**), or
`login()` rejects with `DisallowedIntents`. If your bot reads message text, keep `MessageContent` in its
intents and switch it on. See [The gateway and intents](./topics/gateway.md#intents).

## Accepted but changing nothing

- `allowedMentions.repliedUser` is accepted; a reply pings nobody on Bisim.
- `avatarURL` on a webhook message is ignored, with a warning: Bisim does not show pictures from another
  host for a sender. Give the webhook its own picture with `webhook.edit({ avatar })`.
- `setAFK()` changes nothing visible, as for bots on Discord.
- `tts` is ignored, with a warning.

## Behaving a little differently

- **`ClientReady`** comes after bisim.js has loaded every server (with the member list when the client has
  the `GuildMembers` intent). It is also emitted as `ready`.
- **Embed pictures** (image, thumbnail, author and footer icons) are `http` or `https` links, or
  `attachment://name` for a file sent or kept with the same message. An `attachment://` that names no file of
  the message is left out, with a warning once.
- **Files** keep their place in `message.attachments` even when an embed shows them; Bisim's apps hide such a
  file from the list, as Discord does.
- **Error codes** from Bisim are names such as `BOT_NOT_ALLOWED` or `RATE_LIMITED`, not Discord's numbers.
  Compare `error.code` with those names, or use `error.status`.
- **Audit log entries** use Discord's `AuditLogEvent` numbers in `entry.action`; Bisim's own name for the
  action (`MEMBER_BAN`...) is `entry.actionName`.
- **Events that never fire**, because Bisim has nothing they could report: `GuildMembersChunk`,
  `GuildIntegrationsUpdate`, and the thread, stage, scheduled event and entitlement events.
- **Links.** Message links are `https://bisim.gg/channels/...`, invite links `https://bisim.gg/<code>`, and
  the install link from `generateInvite()` is `https://bisim.gg/oauth2/authorize?...`.
- **Snowflakes** use Bisim's epoch, so `SnowflakeUtil.timestampFrom(id)` gives the right date for Bisim ids.
- **Languages.** Command translations keep `fa` and English; other languages are dropped.

## Voice

Voice has its own package, as on Discord: `@bisim/voice` takes the place of `@discordjs/voice`, with the same
API, and `guild.voiceAdapterCreator` works as before. A bot sends sound only and sits in one voice channel per
server. See [Voice](./voice/index.md).

## Bisim extras

- `client.handleInteraction()` for bots with an [Interactions URL](./interactions/interactions-url.md).
- `channel.permissionOverwrites.fetch()`, since Bisim sends overwrites on request.
- The `bootstrap` client option, to choose what is loaded on connect.
- `PermissionFlagsBits.PokeMembers`, Bisim's own permission.

## A checklist

- [ ] Replace the import.
- [ ] Create the application in Bisim and set `BISIM_TOKEN`.
- [ ] Run the deploy script for your commands.
- [ ] Search your code for the features in the table above.
- [ ] If you compare `error.code` with Discord's numbers, switch to Bisim's names or `error.status`.
- [ ] Start the bot and run each command once.
