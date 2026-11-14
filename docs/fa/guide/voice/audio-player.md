# پخش صدا

صدا از راه یک **پخش‌کننده** (audio player) به کانال صوتی می‌رسد. یک پخش‌کننده می‌سازید، اتصال را به آن وصل
می‌کنید و **منبع صوتی** (audio resource) برای پخش به آن می‌دهید. یک پخش‌کننده می‌تواند هم‌زمان در چند اتصال، در
چند سرور، پخش کند.

```js
const { createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@bisim/voice');

const player = createAudioPlayer();
connection.subscribe(player);

player.play(createAudioResource('./sounds/welcome.mp3'));
player.on(AudioPlayerStatus.Idle, () => console.log('Done'));
```

## منبع صوتی چه می‌تواند باشد

### فایل یا نشانی اینترنتی

رشته یک مسیر یا نشانی است و FFmpeg آن را می‌خواند، پس هر قالبی که FFmpeg بشناسد کار می‌کند: mp3، ogg، wav،
flac، m4a و صدای یک ویدیو.

```js
player.play(createAudioResource('./music/track.flac'));
player.play(createAudioResource('https://example.com/radio/stream.mp3'));
```

### استریم

استریم خواندنی هم کار می‌کند. با `inputType` بگویید چه چیزی در آن است:

| `StreamType` | محتوای استریم | FFmpeg لازم است |
| --- | --- | --- |
| `Arbitrary` (پیش‌فرض) | هر چیزی که FFmpeg بخواند | بله |
| `OggOpus`، `WebmOpus` | فایل Ogg یا WebM با صدای Opus | بله |
| `Opus` | بسته‌های Opus، هر کدام یک Buffer، با ۴۸ کیلوهرتز و دو کانال | خیر |
| `Raw` | نمونه‌های ۱۶ بیتی علامت‌دار little-endian، با ۴۸ کیلوهرتز و دو کانال | خیر |

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

### نگه داشتن داده کنار منبع

`metadata` همراه منبع می‌ماند، و این به صف پخش کمک می‌کند بداند چه چیزی در حال پخش است:

```js
const resource = createAudioResource('./music/track.mp3', { metadata: { title: 'Track one', requestedBy: user.id } });
player.play(resource);
console.log(player.state.resource.metadata.title);
```

## بلندی صدا

منبع را با `inlineVolume: true` بسازید و هر وقت خواستید `resource.volume` را تغییر دهید؛ تغییر در چند ده
میلی‌ثانیه شنیده می‌شود:

```js
const resource = createAudioResource('./music/track.mp3', { inlineVolume: true });
resource.volume.setVolume(0.5); // half
resource.volume.setVolumeDecibels(-3);
resource.volume.setVolumeLogarithmic(0.8); // a curve that sounds even to the ear
```

اگر لازمش ندارید `inlineVolume` را روشن نکنید: برای هر قطعهٔ صدا کمی پردازش می‌گیرد.

## مکث و توقف

```js
player.pause();   // returns false if nothing was playing
player.unpause();
player.stop();    // ends the resource; the player goes Idle
```

`resource.playbackDuration` می‌گوید چند میلی‌ثانیه پخش شده است.

## وضعیت‌ها و رویدادها

| `AudioPlayerStatus` | معنی |
| --- | --- |
| `Idle` | چیزی برای پخش نیست |
| `Buffering` | در انتظار نخستین صدای منبع |
| `Playing` | در حال پخش |
| `Paused` | با `pause()` متوقف شده |
| `AutoPaused` | خودش مکث کرده، چون هیچ اتصالی نمی‌توانست پخش کند (پایین‌تر را ببینید) |

یک صف ساده، وقتی پخش‌کننده به Idle می‌رسد منبع بعدی را پخش می‌کند:

```js
const queue = ['./a.mp3', './b.mp3', './c.mp3'];
player.on(AudioPlayerStatus.Idle, () => {
  const next = queue.shift();
  if (next) player.play(createAudioResource(next));
});
player.play(createAudioResource(queue.shift()));
```

منبعی که خراب شود (فایلی که وجود ندارد، نشانی‌ای که دیگر پاسخ نمی‌دهد) رویداد `error` را با یک
`AudioPlayerError` می‌فرستد که `resource` آن همان منبع خراب است، و پخش‌کننده به Idle می‌رود:

```js
player.on('error', (error) => console.error(`${error.resource.metadata?.title}: ${error.message}`));
```

## وقتی کسی گوش نمی‌دهد

تا وقتی هیچ اتصال وصل‌شده‌ای آماده نیست (مثلاً ربات بین دو کانال است)، پخش‌کننده رفتار `noSubscriber` خود را
دنبال می‌کند:

```js
const { NoSubscriberBehavior } = require('@bisim/voice');

const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
```

`Pause` (پیش‌فرض) صبر می‌کند و وقتی اتصالی آماده شد ادامه می‌دهد، `Play` ادامه می‌دهد و بخشی که شنیده نشده از
دست می‌رود، و `Stop` منبع را تمام می‌کند.

## در برنامه‌های بی‌سیم

تا وقتی پخش‌کننده صدا می‌فرستد، حلقهٔ صحبت ربات برای همهٔ حاضران کانال روشن می‌شود و با مکث یا رسیدن به Idle
خاموش می‌شود.
