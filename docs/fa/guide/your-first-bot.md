# نخستین ربات

در پوشهٔ پروژه یک فایل `index.js` بسازید:

```js
const { Client, Events, GatewayIntentBits } = require('bisim.js');

// One client per bot. The intents say which events it receives.
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Runs once, after every server has been loaded.
client.once(Events.ClientReady, (readyClient) => {
  console.log(`${readyClient.user.tag} is online in ${readyClient.guilds.cache.size} servers.`);
});

// A text command: "!ping" gets the gateway latency back.
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || message.content !== '!ping') return;
  await message.reply(`Pong! ${client.ws.ping} ms`);
});

// The token is read from the BISIM_TOKEN environment variable.
client.login(process.env.BISIM_TOKEN);
```

`MessageContent` یک اینتنت ویژه است و اینجا برای خواندن `!ping` لازم است: اول آن را در پرتال توسعه‌دهندگان
روشن کنید ([bisim.gg/developers](https://bisim.gg/developers)، برنامهٔ شما، **Bot**، **Privileged Gateway
Intents**).

اجرایش کنید:

```sh
node index.js
```

در کنسول نام ربات و تعداد سرورهایش را می‌بینید. در کانالی که ربات به آن دسترسی دارد `!ping` بنویسید تا ربات
پاسخ دهد.

## چه اتفاقی افتاد

- `new Client()` کلاینت را می‌سازد. گزینهٔ `intents` مثل discord.js اجباری است: `Guilds` برای سرورها،
  `GuildMessages` برای پیام‌های آن‌ها و `MessageContent` برای متن پیام‌ها. صفحهٔ
  [گیت‌وی و اینتنت‌ها](./topics/gateway.md) را ببینید.
- `client.login()` توکن را بررسی می‌کند، به گیت‌وی بی‌سیم وصل می‌شود و همهٔ سرورهای ربات را بارگذاری
  می‌کند: کانال‌ها، نقش‌ها، ایموجی‌ها و وضعیت‌های صوتی.
- رویداد `Events.ClientReady` یک بار، وقتی همه‌چیز بارگذاری شد، رخ می‌دهد. ورودی آن خود کلاینت است که
  آمادهٔ استفاده است: `readyClient.user` همان ربات است و `readyClient.guilds.cache` سرورهای آن را نگه می‌دارد.
- رویداد `Events.MessageCreate` برای هر پیامی که ربات ببیند رخ می‌دهد، حتی پیام‌های خود ربات. به همین دلیل
  کنترل‌کننده برای ربات‌ها زود برمی‌گردد.

## تنظیم وضعیت

```js
const { ActivityType } = require('bisim.js');

client.once(Events.ClientReady, (readyClient) => {
  readyClient.user.setPresence({
    activities: [{ name: 'the server', type: ActivityType.Watching }],
    status: 'online',
  });
});
```

`setActivity()` و `setStatus()` هم کار می‌کنند. بی‌سیم فعالیت‌های Playing، Listening، Watching و Competing و
یک وضعیت سفارشی را نشان می‌دهد (`ActivityType.Custom` با `state` برابر متن شما).

## بی‌سیمِ محلی

همهٔ نشانی‌هایی که bisim.js استفاده می‌کند قابل تغییرند؛ مثلاً برای وصل کردن ربات به بی‌سیمی که روی دستگاه
خودتان اجرا می‌شود:

```js
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  rest: { api: 'http://localhost:3000/api' },
  ws: { gateway: 'ws://localhost:4000/ws' },
});
```

## متوقف کردن

`client.destroy()` اتصال را می‌بندد و پس از آن برنامه خودبه‌خود تمام می‌شود. برای متوقف کردن رباتی که در حال
اجراست، <kbd>Ctrl</kbd>+<kbd>C</kbd> را بزنید.

قدم بعدی: [دستورهای اسلش](./slash-commands/index.md).
