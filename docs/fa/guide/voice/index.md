# صدا

ربات با **@bisim/voice**، بستهٔ همراه bisim.js، وارد کانال‌های صوتی می‌شود. نسبت این بسته به bisim.js همان نسبت
`@discordjs/voice` به discord.js است: همان تابع‌ها، کلاس‌ها، رویدادها و نام وضعیت‌ها. پس کد صوتی‌ای که برای دیسکورد
نوشته شده با عوض کردن دو import در بی‌سیم کار می‌کند.

ربات با این بسته می‌تواند:

- وارد کانال صوتی شود، به کانال دیگری برود و بیرون بیاید؛
- فایل، نشانی اینترنتی و استریم پخش کند، با تنظیم صدا، مکث و توقف؛
- صدای دیگران را بشنود: چه کسی حرف می‌زند و چه می‌گوید، به‌صورت بسته‌های Opus یا نمونه‌های خام؛
- صداهای ساندبورد سرور را پخش کند.

## نصب

```sh
npm install bisim.js @bisim/voice
```

هر چه خود اتصال لازم دارد با همین نصب می‌آید: SDK رسمی LiveKit برای Node.js (صدای بی‌سیم روی LiveKit اجرا
می‌شود) با نسخهٔ آماده‌اش برای ویندوز، macOS و لینوکس، و یک کدک Opus که با جاوااسکریپت نوشته شده است. کتاب‌خانهٔ
Opus یا رمزنگاری جداگانه‌ای لازم نیست و چیزی هم کامپایل نمی‌شود.

### FFmpeg

برای پخش فایل و نشانی اینترنتی، [FFmpeg](https://ffmpeg.org/download.html) را نصب کنید تا دستور `ffmpeg` در
ترمینال اجرا شود. دو راه دیگر هم هست:

- `npm install ffmpeg-static` که یک نسخهٔ آماده را در پروژهٔ شما می‌گذارد؛
- متغیر محیطی `FFMPEG_PATH` با مسیر کامل `ffmpeg`.

نمونه‌های خام و بسته‌های Opus بدون FFmpeg هم پخش می‌شوند.

### بررسی نصب

```js
const { generateDependencyReport } = require('@bisim/voice');

console.log(generateDependencyReport());
```

این گزارش نسخه‌های در حال استفاده را نشان می‌دهد، می‌گوید ماژول بومی LiveKit بارگذاری می‌شود یا نه، و FFmpeg
کجا پیدا شده است. وقتی کمک می‌خواهید آن را در issue بگذارید.

SDK خود LiveKit هنگام اتصال یک خط گزارش می‌نویسد؛ با `NODE_ENV=production` چیزی نمی‌نویسد.

### دسترسی‌ها

ربات در کانال صوتی برای ورود به **View Channel** و **Connect** و برای شنیده شدن به **Speak** نیاز دارد. پخش
صدای ساندبورد **Use Soundboard** را هم لازم دارد.

## آمدن از @discordjs/voice

```diff
- const { Client, GatewayIntentBits } = require('discord.js');
- const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
+ const { Client, GatewayIntentBits } = require('bisim.js');
+ const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@bisim/voice');
```

`adapterCreator: guild.voiceAdapterCreator` همان می‌ماند. مثل همه‌جای bisim.js فقط کلمهٔ «Discord» در نام‌ها
عوض می‌شود: `DiscordGatewayAdapterCreator` می‌شود `BisimGatewayAdapterCreator` و `validateDiscordOpusHead`
می‌شود `validateBisimOpusHead`.

## تفاوت‌ها در بی‌سیم

- **فقط صدا.** ربات صدا می‌فرستد؛ دوربین ندارد و صفحه به اشتراک نمی‌گذارد.
- **یک کانال صوتی در هر سرور.** ورود به کانال دیگری از همان سرور، ربات را از کانال اول بیرون می‌برد، مثل
  دیسکورد. ربات می‌تواند هم‌زمان در چند سرور در کانال صوتی باشد.
- **بدون تماس خصوصی.** ربات فقط وارد کانال‌های صوتی سرور می‌شود؛ تماس خصوصی پاسخ 403 می‌دهد.
- **چیزی برای Opus یا رمزنگاری نصب نمی‌شود.** `@discordjs/opus`، `sodium-native`، `libsodium-wrappers`،
  `tweetnacl` و DAVE لازم نیستند: کدک Opus همراه @bisim/voice می‌آید و LiveKit صدا را در مسیر رمزنگاری می‌کند.
  `daveEncryption` و `decryptionFailureTolerance` پذیرفته می‌شوند و چیزی را تغییر نمی‌دهند.
- **بخش‌های ساکت در صدای دریافتی نمی‌آیند**، مثل دیسکورد: استریم همان چیزی را دارد که کسی می‌گوید.
- **`selfMute: true` چیزی نمی‌فرستد.** رباتی که بی‌صدا نشان داده می‌شود شنیده هم نمی‌شود.
- **`connection.ping`** مقدار `{ ws: undefined, udp: undefined }` دارد.
- **ماژول بومی LiveKit پس از نخستین اتصال، Node.js را باز نگه می‌دارد.** ربات به‌هرحال تا وقتی متوقفش کنید
  اجرا می‌شود؛ اسکریپتی که باید تمام شود `process.exit()` را صدا می‌زند.

## ادامه

- [اتصال صوتی](./connections.md): ورود، جابه‌جایی، خروج، و اینکه وقتی اتصال قطع می‌شود چه پیش می‌آید.
- [پخش صدا](./audio-player.md): فایل، نشانی اینترنتی، استریم، تنظیم صدا و مکث.
- [دریافت صدا](./receiving.md): چه کسی حرف می‌زند و چه می‌گوید.

همهٔ کلاس‌ها و گزینه‌ها در [مرجع API بستهٔ @bisim/voice](https://bisim-gg.github.io/voice/) (انگلیسی) آمده‌اند.
