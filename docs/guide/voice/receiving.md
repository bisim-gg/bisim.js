# Receiving audio

A connection's `receiver` hears the others in the channel. Join with `selfDeaf: false` for it to work: a
deafened bot receives nothing.

```js
const connection = joinVoiceChannel({
  channelId: voiceChannel.id,
  guildId: voiceChannel.guild.id,
  adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  selfDeaf: false,
});
```

## Who is speaking

`receiver.speaking` emits `start` and `end` with the user id. Someone starts speaking when their sound rises
above a quiet level, and stops a moment after it last did, so the pauses between words do not count:

```js
connection.receiver.speaking.on('start', (userId) => console.log(`${userId} is speaking`));
connection.receiver.speaking.on('end', (userId) => console.log(`${userId} stopped`));
```

`receiver.speaking.users` holds who is speaking now.

## What they say

`receiver.subscribe(userId)` returns a readable stream of **Opus packets**, one Buffer per 20 milliseconds,
48 kHz stereo, as on Discord. Quiet stretches are left out, so the stream carries what the person says. Choose
when it ends with `end`:

```js
const { EndBehaviorType } = require('@bisim/voice');

const opus = connection.receiver.subscribe(userId, {
  end: { behavior: EndBehaviorType.AfterSilence, duration: 1_000 },
});
opus.on('data', (packet) => console.log(`${packet.length} bytes from ${userId}`));
opus.on('end', () => console.log(`${userId} went quiet`));
```

| `EndBehaviorType` | The stream ends |
| --- | --- |
| `Manual` (the default) | When you call `stream.destroy()` |
| `AfterSilence` | After the person was quiet for `duration` milliseconds |
| `AfterInactivity` | After no audio arrived for `duration` milliseconds |

Asking again for the same person returns the stream that is already open.

### Samples instead of Opus

For speech recognition or your own analysis, ask for samples and skip the decoding:

```js
const pcm = connection.receiver.subscribe(userId, { end: { behavior: EndBehaviorType.Manual }, mode: 'pcm' });
pcm.on('data', (frame) => {
  // 3840 bytes: 960 samples per channel, two channels, signed 16-bit little-endian, 48 kHz.
});
```

### Decoding Opus yourself

Code that already decodes Discord's packets with [prism-media](https://www.npmjs.com/package/prism-media) 1.3
works unchanged, and finds the Opus codec @bisim/voice brings, so there is nothing else to install:

```js
const prism = require('prism-media');

const decoded = opus.pipe(new prism.opus.Decoder({ rate: 48_000, channels: 2, frameSize: 960 }));
```

### Saving a recording

Hand the samples to FFmpeg and let it write the file, in any format it knows:

```js
const { spawn } = require('node:child_process');

function record(connection, userId) {
  const pcm = connection.receiver.subscribe(userId, {
    end: { behavior: EndBehaviorType.AfterSilence, duration: 1_000 },
    mode: 'pcm',
  });
  const file = `./recording-${userId}-${Date.now()}.ogg`;
  const ffmpeg = spawn('ffmpeg', ['-loglevel', 'error', '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0', file]);
  pcm.pipe(ffmpeg.stdin);
  return new Promise((resolve) => ffmpeg.once('close', () => resolve(file)));
}
```

## Good to know

- A moderator's server deafen stops the audio reaching the bot at the voice server, not only in your code.
- Recording people is something to be open about: tell the members of your server when the bot listens.
