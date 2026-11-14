# Playing audio

Sound reaches a voice channel through an **audio player**. You make one player, subscribe a connection to it,
and give it **audio resources** to play. One player can play into several connections, in several servers, at
once.

```js
const { createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@bisim/voice');

const player = createAudioPlayer();
connection.subscribe(player);

player.play(createAudioResource('./sounds/welcome.mp3'));
player.on(AudioPlayerStatus.Idle, () => console.log('Done'));
```

## What a resource can be

### A file or a URL

A string is a path or an address, and FFmpeg reads it, so any format FFmpeg knows works: mp3, ogg, wav, flac,
m4a, the sound of a video.

```js
player.play(createAudioResource('./music/track.flac'));
player.play(createAudioResource('https://example.com/radio/stream.mp3'));
```

### A stream

A readable stream works too. Tell the resource what it holds with `inputType`:

| `StreamType` | The stream holds | FFmpeg needed |
| --- | --- | --- |
| `Arbitrary` (the default) | Anything FFmpeg reads | Yes |
| `OggOpus`, `WebmOpus` | An Ogg or WebM file with Opus audio | Yes |
| `Opus` | Opus packets, one Buffer each, 48 kHz stereo | No |
| `Raw` | Signed 16-bit little-endian samples, 48 kHz, two channels | No |

```js
const { createReadStream } = require('node:fs');
const { StreamType } = require('@bisim/voice');

// Samples you made yourself, for example a tone or speech from a text to speech engine.
player.play(createAudioResource(samples, { inputType: StreamType.Raw }));

// Not sure what a file holds? demuxProbe reads its start and tells you.
const { demuxProbe } = require('@bisim/voice');
const { stream, type } = await demuxProbe(createReadStream('./clip.ogg'));
player.play(createAudioResource(stream, { inputType: type }));
```

### Keeping data with it

`metadata` stays with the resource, which helps a queue know what is playing:

```js
const resource = createAudioResource('./music/track.mp3', { metadata: { title: 'Track one', requestedBy: user.id } });
player.play(resource);
console.log(player.state.resource.metadata.title);
```

## Volume

Make the resource with `inlineVolume: true` and change `resource.volume` at any time; the change is heard
within a few dozen milliseconds:

```js
const resource = createAudioResource('./music/track.mp3', { inlineVolume: true });
resource.volume.setVolume(0.5); // half
resource.volume.setVolumeDecibels(-3);
resource.volume.setVolumeLogarithmic(0.8); // a curve that sounds even to the ear
```

Leave `inlineVolume` off when you do not need it: it costs a little processing on every frame.

## Pausing and stopping

```js
player.pause();   // returns false if nothing was playing
player.unpause();
player.stop();    // ends the resource; the player goes Idle
```

`resource.playbackDuration` says how many milliseconds have been played.

## Statuses and events

| `AudioPlayerStatus` | Meaning |
| --- | --- |
| `Idle` | Nothing to play |
| `Buffering` | Waiting for the resource's first audio |
| `Playing` | Playing |
| `Paused` | Paused with `pause()` |
| `AutoPaused` | Paused by itself because no connection could play (see below) |

A simple queue plays the next resource when the player goes Idle:

```js
const queue = ['./a.mp3', './b.mp3', './c.mp3'];
player.on(AudioPlayerStatus.Idle, () => {
  const next = queue.shift();
  if (next) player.play(createAudioResource(next));
});
player.play(createAudioResource(queue.shift()));
```

A resource that fails (a file that does not exist, a URL that stops answering) emits `error` with an
`AudioPlayerError`, whose `resource` is the one that failed, and the player goes Idle:

```js
player.on('error', (error) => console.error(`${error.resource.metadata?.title}: ${error.message}`));
```

## When nobody listens

While no subscribed connection is ready (the bot is between channels, say), the player follows its
`noSubscriber` behavior:

```js
const { NoSubscriberBehavior } = require('@bisim/voice');

const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
```

`Pause` (the default) waits and carries on once a connection is ready, `Play` keeps going and the unheard part
is lost, and `Stop` ends the resource.

## In Bisim's apps

While the player sends sound the bot's speaking ring lights up for everyone in the channel, and it goes dark
when the player pauses or goes Idle.
