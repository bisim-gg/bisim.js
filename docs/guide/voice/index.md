# Voice

A bot joins voice channels with **@bisim/voice**, the companion package of bisim.js. It is to bisim.js what
`@discordjs/voice` is to discord.js, with the same functions, classes, events and status names, so voice code
written for Discord moves over by changing two imports.

With it a bot can:

- join a voice channel, move to another one and leave;
- play files, URLs and streams, with volume, pause and stop;
- hear the others: who is speaking, and what they say, as Opus packets or as raw samples;
- play the server's soundboard sounds.

## Installing

```sh
npm install bisim.js @bisim/voice
```

That brings everything the connection itself needs: LiveKit's Node.js SDK (Bisim's voice runs on LiveKit) with
its native build for Windows, macOS and Linux, and an Opus codec written in JavaScript. There are no Opus or
encryption libraries to install, and nothing to compile.

### FFmpeg

To play files and URLs, install [FFmpeg](https://ffmpeg.org/download.html) so that `ffmpeg` runs from a terminal.
Two other ways work too:

- `npm install ffmpeg-static`, which downloads a build into your project;
- the environment variable `FFMPEG_PATH`, set to the full path of `ffmpeg`.

Raw samples and Opus packets play without FFmpeg.

### Checking the setup

```js
const { generateDependencyReport } = require('@bisim/voice');

console.log(generateDependencyReport());
```

It prints the versions in use, whether LiveKit's native module loads, and where FFmpeg was found. Paste it
into an issue when you ask for help.

LiveKit's SDK logs a line of its own when it connects; with `NODE_ENV=production` it stays quiet.

### Permissions

In the voice channel the bot needs **View Channel** and **Connect** to join, and **Speak** to be heard. Playing
a soundboard sound also takes **Use Soundboard**.

## Moving from @discordjs/voice

```diff
- const { Client, GatewayIntentBits } = require('discord.js');
- const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
+ const { Client, GatewayIntentBits } = require('bisim.js');
+ const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@bisim/voice');
```

`adapterCreator: guild.voiceAdapterCreator` stays as it is. As everywhere in bisim.js, only the word "Discord"
changes in a name: `DiscordGatewayAdapterCreator` is `BisimGatewayAdapterCreator`, and
`validateDiscordOpusHead` is `validateBisimOpusHead`.

## What is different on Bisim

- **Sound only.** A bot sends audio; it has no camera and does not share a screen.
- **One voice channel per server.** Joining another channel of the same server leaves the first, as on
  Discord. A bot can be in voice in many servers at once.
- **No DM calls.** Bots join server voice channels only; a DM call answers with a 403.
- **Nothing to install for Opus or encryption.** `@discordjs/opus`, `sodium-native`, `libsodium-wrappers`,
  `tweetnacl` and DAVE are not needed: the Opus codec comes with @bisim/voice, and the media is encrypted in
  transit by LiveKit. `daveEncryption` and `decryptionFailureTolerance` are accepted and change nothing.
- **Quiet stretches are left out of what you receive**, as on Discord: a stream carries what someone says.
- **`selfMute: true` sends nothing.** A bot shown as muted is not heard.
- **`connection.ping`** is `{ ws: undefined, udp: undefined }`.
- **LiveKit's native module keeps Node.js running** once a connection was made. A bot runs until you stop it
  anyway; a script that should end calls `process.exit()`.

## Next

- [Voice connections](./connections.md): joining, moving, leaving, and what happens when a connection drops.
- [Playing audio](./audio-player.md): files, URLs, streams, volume and pausing.
- [Receiving audio](./receiving.md): who is speaking, and what they say.

Every class and option is in the [@bisim/voice API reference](https://bisim-gg.github.io/voice/).
