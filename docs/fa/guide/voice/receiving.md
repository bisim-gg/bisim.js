# دریافت صدا

`receiver` هر اتصال صدای دیگران را در کانال می‌شنود. برای این کار با `selfDeaf: false` وارد شوید: ربات با گوش
بسته چیزی دریافت نمی‌کند.

```js
const connection = joinVoiceChannel({
  channelId: voiceChannel.id,
  guildId: voiceChannel.guild.id,
  adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  selfDeaf: false,
});
```

## چه کسی حرف می‌زند

`receiver.speaking` رویدادهای `start` و `end` را با شناسهٔ کاربر می‌فرستد. کسی وقتی شروع به حرف زدن می‌کند که
صدایش از یک سطح آرام بالاتر برود، و کمی پس از آخرین باری که بالاتر بود تمام می‌کند، تا مکث‌های میان کلمه‌ها به
حساب نیایند:

```js
connection.receiver.speaking.on('start', (userId) => console.log(`${userId} is speaking`));
connection.receiver.speaking.on('end', (userId) => console.log(`${userId} stopped`));
```

`receiver.speaking.users` کسانی را نگه می‌دارد که همین حالا حرف می‌زنند.

## چه می‌گویند

`receiver.subscribe(userId)` یک استریم خواندنی از **بسته‌های Opus** برمی‌گرداند، برای هر ۲۰ میلی‌ثانیه یک Buffer،
با ۴۸ کیلوهرتز و دو کانال، مثل دیسکورد. بخش‌های ساکت در آن نمی‌آیند، پس استریم همان چیزی را دارد که آن شخص
می‌گوید. با `end` انتخاب کنید کی تمام شود:

```js
const { EndBehaviorType } = require('@bisim/voice');

const opus = connection.receiver.subscribe(userId, {
  end: { behavior: EndBehaviorType.AfterSilence, duration: 1_000 },
});
opus.on('data', (packet) => console.log(`${packet.length} bytes from ${userId}`));
opus.on('end', () => console.log(`${userId} went quiet`));
```

| `EndBehaviorType` | استریم کی تمام می‌شود |
| --- | --- |
| `Manual` (پیش‌فرض) | وقتی `stream.destroy()` را صدا بزنید |
| `AfterSilence` | پس از اینکه آن شخص `duration` میلی‌ثانیه ساکت بماند |
| `AfterInactivity` | پس از اینکه `duration` میلی‌ثانیه صدایی نرسد |

درخواست دوباره برای همان شخص، همان استریم باز را برمی‌گرداند.

### نمونهٔ خام به‌جای Opus

برای تبدیل گفتار به متن یا تحلیل خودتان، نمونهٔ خام بخواهید و از رمزگشایی بگذرید:

```js
const pcm = connection.receiver.subscribe(userId, { end: { behavior: EndBehaviorType.Manual }, mode: 'pcm' });
pcm.on('data', (frame) => {
  // 3840 bytes: 960 samples per channel, two channels, signed 16-bit little-endian, 48 kHz.
});
```

### رمزگشایی Opus با کد خودتان

کدی که بسته‌های دیسکورد را با [prism-media](https://www.npmjs.com/package/prism-media) نسخهٔ ۱٫۳ رمزگشایی
می‌کند بدون تغییر کار می‌کند و کدک Opusِ همراه @bisim/voice را پیدا می‌کند، پس چیز دیگری نصب نمی‌شود:

```js
const prism = require('prism-media');

const decoded = opus.pipe(new prism.opus.Decoder({ rate: 48_000, channels: 2, frameSize: 960 }));
```

### ذخیرهٔ صدای ضبط‌شده

نمونه‌ها را به FFmpeg بدهید تا فایل را با هر قالبی که می‌شناسد بنویسد:

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

## خوب است بدانید

- گوش بستنِ ربات توسط یک مدیر، صدا را در خود سرور صدا از ربات دور نگه می‌دارد، نه فقط در کد شما.
- ضبط صدای دیگران کاری است که باید آشکار باشد: به اعضای سرورتان بگویید چه وقت ربات گوش می‌دهد.
