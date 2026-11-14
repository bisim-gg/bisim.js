# اتصال صوتی

## ورود به کانال

`joinVoiceChannel` وارد کانال صوتی می‌شود و یک `VoiceConnection` برمی‌گرداند. دستور `/join` که ربات را به کانال
صوتیِ کسی که دستور را زده می‌آورد:

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

`guild.voiceAdapterCreator` را bisim.js می‌دهد: از راه API بی‌سیم وارد کانال می‌شود و هر چه اتصال لازم دارد به آن
می‌رساند. گزینه‌ها:

| گزینه | پیش‌فرض | کارش |
| --- | --- | --- |
| `channelId`، `guildId` | | کجا وارد شود |
| `adapterCreator` | | `guild.voiceAdapterCreator` |
| `selfDeaf` | `true` | با گوش بسته وارد شود: ربات صدای هیچ‌کس را دریافت نمی‌کند |
| `selfMute` | `false` | بی‌صدا وارد شود: ربات چیزی نمی‌فرستد |
| `group` | `'default'` | اتصال را در گروهی از خودتان نگه دارد |
| `debug` | `false` | رویداد `debug` بفرستد |

## چرخهٔ زندگی اتصال

اتصال همیشه در یکی از پنج وضعیت است، `connection.state.status`:

| وضعیت | معنی |
| --- | --- |
| `Signalling` | ورود درخواست شده؛ در انتظار پاسخ بی‌سیم |
| `Connecting` | در حال اتصال به سرور صدا |
| `Ready` | وصل است: صدا در هر دو جهت جریان دارد |
| `Disconnected` | وصل نیست و تلاشی هم نمی‌کند؛ `rejoin()` دوباره تلاش می‌کند |
| `Destroyed` | برای همیشه تمام شده؛ برای اتصال تازه دوباره وارد شوید |

برای یک وضعیت با نامش گوش بدهید، یا برای هر تغییر با `stateChange`:

```js
connection.on(VoiceConnectionStatus.Ready, () => console.log('Connected'));
connection.on('stateChange', (before, after) => console.log(`${before.status} to ${after.status}`));
```

`entersState(connection, status, ms)` منتظر یک وضعیت می‌ماند و پس از `ms` میلی‌ثانیه، یا به محض اینکه اتصال
خطایی بفرستد، رد می‌شود.

## قطعی‌ها و قطع اتصال

وقتی شبکه لحظه‌ای قطع می‌شود، LiveKit خودش اتصال را برمی‌گرداند و وضعیت به `Connecting` می‌رود و به `Ready`
برمی‌گردد. اگر نتواند، اتصال خودش از بی‌سیم یک ورود تازه می‌خواهد و دوباره از `Signalling` می‌گذرد و این تلاش را
در `connection.rejoinAttempts` می‌شمارد (که با رسیدن به `Ready` صفر می‌شود).

اتصال وقتی در `Disconnected` می‌ماند که کسی عمداً آن را تمام کرده باشد، یا اصلاً نتوان وصل شد. `closeCode` آن
می‌گوید کدام:

| `closeCode` | چرا |
| --- | --- |
| `4014` | یک مدیر ربات را از کانال بیرون کرد، ربات اجازهٔ ماندن در کانال را از دست داد، یا نسخهٔ دیگری از ربات جایش را گرفت |
| `4022` | تماس برای همه تمام شد، مثلاً کانال پاک شد |
| `1006` | به سرور صدا نمی‌شد رسید |

ورودی که رد شود (مثلاً بدون دسترسی Connect) با دلیل `EndpointRemoved` در `Disconnected` تمام می‌شود و خطا به
شنوندهٔ `error` شما می‌رسد. شنونده‌ای که چند بار تلاش می‌کند و بعد کنار می‌کشد:

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

## جابه‌جایی

`joinVoiceChannel` را با کانال دیگری از همان سرور دوباره صدا بزنید: همان اتصال به آنجا می‌رود و بی‌سیم ربات را
از کانال اول بیرون می‌برد.

```js
joinVoiceChannel({ channelId: otherChannel.id, guildId: otherChannel.guild.id, adapterCreator: otherChannel.guild.voiceAdapterCreator });
```

وقتی یک مدیر ربات را جابه‌جا می‌کند، ربات خودش دنبال می‌کند: اتصال در کانال تازه دوباره وصل می‌شود و
`connection.joinConfig.channelId` نام آن را دارد. هر چه در حال پخش بود ادامه پیدا می‌کند.

## بی‌صدا و گوش بسته

```js
connection.rejoin({ channelId: connection.joinConfig.channelId, selfMute: true, selfDeaf: false });
```

این فقط وضعیت خود ربات را عوض می‌کند و دوباره وصل نمی‌شود. همهٔ اعضای سرور تغییر را کنار نام ربات می‌بینند.
ربات بی‌صدا چیزی نمی‌فرستد و ربات با گوش بسته چیزی دریافت نمی‌کند.

## خروج

```js
connection.destroy();
```

`destroy()` از کانال بیرون می‌آید و اتصال را برای همیشه تمام می‌کند. `disconnect()` بیرون می‌آید اما اتصال را
نگه می‌دارد تا `rejoin()` بعداً برش گرداند.

## پیدا کردن اتصال

اتصال‌ها برای هر سرور نگه داشته می‌شوند:

```js
const { getVoiceConnection } = require('@bisim/voice');

const connection = getVoiceConnection(interaction.guildId);
connection?.destroy();
```

## ساندبورد

وقتی ربات در کانال صوتی است، می‌تواند یکی از صداهای ساندبورد سرور را برای همهٔ حاضران پخش کند:

```js
await voiceChannel.sendSoundboardSound({ soundId: '123456789012345678' });
```
