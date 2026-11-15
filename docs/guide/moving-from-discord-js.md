# Moving from discord.js

bisim.js follows discord.js v14 closely, so most bots move by changing two things.

## The two changes

1. The import:

   ```diff
   - const { Client, Events, GatewayIntentBits } = require('discord.js');
   + const { Client, Events, GatewayIntentBits } = require('bisim.js');
   ```

2. The token: create an application in Bisim (**Settings**, **Applications**) and use its token. Register
   your commands again with the deploy script; Bisim keeps its own command list.

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
| Files in interaction replies and webhooks | `interaction.reply({ files })`, `webhook.send({ files })` |
| Editing past webhook messages | `webhook.editMessage()`, `fetchMessage()`, `deleteMessage()` |
| Removing every reaction of one emoji | `reaction.remove()` (use `reaction.users.remove()` or `message.reactions.removeAll()`) |
| Bot avatars, server icons and banners through the API | `client.user.setAvatar()`, `guild.setIcon()` |
| Default values in select menus, labels in modals | `setDefaultUsers()`, `addLabelComponents()` |
| Changing a channel's type, bitrate, user limit or region | the matching `channel.set...()` methods |

## Accepted but changing nothing

- `intents` are required and ignored: a bot receives what its permissions let it see.
- `allowedMentions` is accepted; Bisim does not filter mentions yet.
- `setAFK()` changes nothing visible, as for bots on Discord.
- `tts` is ignored, with a warning.

## Behaving a little differently

- **`ClientReady`** comes after bisim.js has loaded every server, members included. It is also emitted as
  `ready`.
- **Embed pictures** (image, thumbnail, author and footer icons) must be `http` or `https` links. An
  `attachment://` picture is left out of the message, with a warning once.
- **Error codes** from Bisim are names such as `BOT_NOT_ALLOWED` or `RATE_LIMITED`, not Discord's numbers.
  Compare `error.code` with those names, or use `error.status`.
- **Channel and ban events.** Channels created or deleted are noticed through server refreshes, so
  `ChannelCreate` and `ChannelDelete` still fire. `GuildBanAdd`, `GuildBanRemove`, `InviteCreate` and
  `InviteDelete` never do.
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
