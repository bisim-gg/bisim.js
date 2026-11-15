# Voice connections

## Joining

`joinVoiceChannel` joins a voice channel and returns a `VoiceConnection`. A `/join` command that brings the
bot to the caller's channel:

```js
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@bisim/voice');

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'join') return;
  const target = interaction.member.voice.channel;
  if (!target) return interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
  if (!target.joinable) return interaction.reply({ content: 'I cannot join that channel.', ephemeral: true });

  const connection = joinVoiceChannel({
    channelId: target.id,
    guildId: target.guild.id,
    adapterCreator: target.guild.voiceAdapterCreator,
  });
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    await interaction.reply(`Joined ${target.name}.`);
  } catch {
    connection.destroy();
    await interaction.reply({ content: 'Could not connect.', ephemeral: true });
  }
});
```

`guild.voiceAdapterCreator` comes from bisim.js: it joins over Bisim's API and hands the connection what it
needs. The options:

| Option | Default | What it does |
| --- | --- | --- |
| `channelId`, `guildId` | | Where to join |
| `adapterCreator` | | `guild.voiceAdapterCreator` |
| `selfDeaf` | `true` | Join deafened: the bot then receives nobody's audio |
| `selfMute` | `false` | Join muted: the bot then sends nothing |
| `group` | `'default'` | Keep the connection in a group of your own |
| `debug` | `false` | Emit `debug` events |

## The life of a connection

A connection is always in one of five statuses, `connection.state.status`:

| Status | Meaning |
| --- | --- |
| `Signalling` | The join was asked for; waiting for Bisim's answer |
| `Connecting` | Connecting to the voice server |
| `Ready` | Connected: audio flows both ways |
| `Disconnected` | Not connected and not trying to; `rejoin()` tries again |
| `Destroyed` | Gone for good; join again to get a new connection |

Listen for a status by its name, or for every change with `stateChange`:

```js
connection.on(VoiceConnectionStatus.Ready, () => console.log('Connected'));
connection.on('stateChange', (before, after) => console.log(`${before.status} to ${after.status}`));
```

`entersState(connection, status, ms)` waits for a status and rejects after `ms` milliseconds, or as soon as
the connection emits an error.

## Drops and disconnects

When the network drops for a moment, LiveKit gets the connection back by itself and the status goes to
`Connecting` and back to `Ready`. If it cannot, the connection asks Bisim for a fresh join on its own and goes
through `Signalling` again, counting the attempt in `connection.rejoinAttempts` (back to 0 once `Ready`).

It ends in `Disconnected` when someone meant it to end, or when a connection could not be made at all. Its
`closeCode` says which:

| `closeCode` | Why |
| --- | --- |
| `4014` | A moderator disconnected the bot, it lost the right to be in the channel, or another copy of the bot took its place |
| `4022` | The call ended for everyone, for example the channel was deleted |
| `1006` | The voice server could not be reached |

A refused join (no Connect permission, say) ends in `Disconnected` with the reason `EndpointRemoved`, and the
error reaches your `error` listener. A handler that tries a few times and then gives up:

```js
const { VoiceConnectionDisconnectReason } = require('@bisim/voice');

connection.on(VoiceConnectionStatus.Disconnected, async (_before, after) => {
  const removed = after.reason === VoiceConnectionDisconnectReason.WebSocketClose && after.closeCode === 4014;
  if (!removed && connection.rejoinAttempts < 5) {
    await new Promise((resolve) => setTimeout(resolve, (connection.rejoinAttempts + 1) * 5_000));
    connection.rejoin();
  } else {
    connection.destroy();
  }
});

connection.on('error', (error) => console.warn('Voice error:', error.message));
```

## Moving

Call `joinVoiceChannel` again with another channel of the same server: the same connection moves there, and
Bisim takes the bot out of the first channel.

```js
joinVoiceChannel({ channelId: otherChannel.id, guildId: otherChannel.guild.id, adapterCreator: otherChannel.guild.voiceAdapterCreator });
```

When a moderator moves the bot, it follows by itself: the connection reconnects in the new channel and
`connection.joinConfig.channelId` names it. Whatever was playing carries on.

## Mute and deafen

```js
connection.rejoin({ channelId: connection.joinConfig.channelId, selfMute: true, selfDeaf: false });
```

This only changes the bot's own state; it does not reconnect. Everyone in the server sees the change beside the
bot's name. A muted bot sends no sound; a deafened bot receives none.

## Leaving

```js
connection.destroy();
```

`destroy()` leaves the channel and ends the connection for good. `disconnect()` leaves but keeps the connection,
so `rejoin()` can bring it back later.

## Finding a connection

Connections are kept per server:

```js
const { getVoiceConnection } = require('@bisim/voice');

const connection = getVoiceConnection(interaction.guildId);
connection?.destroy();
```

## The soundboard

While the bot is in a voice channel it can play one of the server's soundboard sounds for everyone there:

```js
await voiceChannel.sendSoundboardSound({ soundId: '123456789012345678' });
```

The server's sounds are in `guild.soundboardSounds` (fill it with `fetch()`), and the events
`GuildSoundboardSoundCreate`, `GuildSoundboardSoundUpdate` and `GuildSoundboardSoundDelete` keep it current.
When anyone plays a sound, `VoiceChannelEffectSend` brings a `VoiceChannelEffect` with `soundId`,
`soundVolume`, `userId` and `channel`.

## The channel's status

While in the call, a bot with Set Voice Channel Status can set the line shown under the channel's name:

```js
await voiceChannel.setStatus('Now playing: lo-fi beats');
await voiceChannel.setStatus(''); // clears it
```
