# گیت‌وی و اینتنت‌ها

گیت‌وی اتصال WebSocket است که بی‌سیم رویدادها را از راه آن می‌فرستد. bisim.js آن را برایتان مدیریت می‌کند؛ این
صفحه توضیح می‌دهد چه کاری انجام می‌شود تا رفتارش برایتان روشن باشد.

## اتصال

وقتی `client.login()` را صدا می‌زنید، bisim.js:

1. توکن را بررسی می‌کند و کاربر خود ربات را می‌خواند.
2. از بی‌سیم یک مجوز کوتاه‌مدت برای گیت‌وی می‌گیرد، اینتنت‌های شما را همراه آن می‌فرستد و با آن وصل می‌شود.
   برای هر اتصال مجوز تازه‌ای گرفته می‌شود.
3. ضربان (heartbeat) می‌فرستد تا بی‌سیم ربات را آنلاین نشان دهد. زمان رفت‌وبرگشت آن همان `client.ws.ping` است.
4. همهٔ سرورهای ربات را همراه کانال‌ها، نقش‌ها، ایموجی‌ها و وضعیت‌های صوتی بارگذاری می‌کند (و با اینتنت
   `GuildMembers` فهرست اعضا را هم) و به رویدادهای هر سرور می‌پیوندد.
5. وقتی همه‌چیز آماده شد، `ClientReady` را منتشر می‌کند.

رویدادهایی که هنگام بارگذاری سرورها برسند، منتظر می‌مانند و درست پس از `ClientReady` منتشر می‌شوند.

## اینتنت‌ها

اینتنت‌ها (intents) مثل دیسکورد می‌گویند ربات چه رویدادهایی می‌خواهد. bisim.js هنگام اتصال
`client.options.intents` را می‌فرستد و بی‌سیم از میان رویدادهایی که دسترسی‌های ربات اجازه می‌دهند، فقط همان‌هایی
را می‌فرستد که اینتنت‌ها در بر می‌گیرند. فقط چیزی را بخواهید که ربات به کار می‌برد:

```js
const { Client, GatewayIntentBits } = require('bisim.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});
```

| اینتنت | رویدادها |
| --- | --- |
| `Guilds` | تغییر سرور، کانال‌ها و نقش‌ها، سنجاق‌ها |
| `GuildMembers` (ویژه) | آمدن، تغییر و رفتن اعضا |
| `GuildModeration` | بن‌ها و ردیف‌های گزارش ممیزی (audit log) |
| `GuildExpressions` | ایموجی‌ها، استیکرها و صداهای ساندبورد |
| `GuildWebhooks` | `WebhooksUpdate` |
| `GuildInvites` | ساخته شدن و حذف شدن دعوت‌ها |
| `GuildVoiceStates` | `VoiceStateUpdate` |
| `GuildPresences` (ویژه) | `PresenceUpdate` |
| `GuildMessages`، `DirectMessages` | ساخته شدن، ویرایش و حذف پیام‌ها |
| `GuildMessageReactions`، `DirectMessageReactions` | واکنش‌ها |
| `GuildMessageTyping`، `DirectMessageTyping` | `TypingStart` |
| `GuildMessagePolls`، `DirectMessagePolls` | رأی‌های نظرسنجی |
| `MessageContent` (ویژه) | متن، امبدها، فایل‌ها، کامپوننت‌ها و نظرسنجی پیام‌ها |
| `AutoModerationConfiguration` | ساخته شدن، تغییر و حذف قانون‌های AutoMod |
| `AutoModerationExecution` | `AutoModerationActionExecution` |

`GuildScheduledEvents` و `GuildIntegrations` پذیرفته می‌شوند ولی چیزی نمی‌آورند، چون بی‌سیم هیچ‌کدام را ندارد.
تعامل‌ها (interactions) همیشه می‌رسند، اینتنت‌ها هر چه باشند. ربات همیشه از عضویت و وضعیت صوتی خودش باخبر
می‌شود.

### اینتنت‌های ویژه

`GuildMembers`، `GuildPresences` و `MessageContent` ویژه (privileged) هستند. هر کدام را که به کار می‌برید در
پرتال توسعه‌دهندگان روشن کنید: [bisim.gg/developers](https://bisim.gg/developers)، برنامهٔ شما، **Bot**،
**Privileged Gateway Intents**. وقتی ربات در ۱۰۰ سرور یا بیشتر باشد، بی‌سیم هم باید آن‌ها را تأیید کند؛
درخواستش را در همان صفحه بفرستید.

رباتی که `MessageContent` ندارد پیام‌ها را می‌گیرد، اما با `content` خالی و بدون امبد، پیوست، کامپوننت و
نظرسنجی؛ مگر پیام‌های خود ربات، پیام‌هایی که به آن اشاره می‌کنند، و پیام‌های خصوصی. دستورها و دکمه‌ها به
اینتنتی نیاز ندارند: تعامل‌ها همیشه کامل‌اند. `message.mentions` و `message.member` در هر حال کار می‌کنند، چون
بی‌سیم آن‌ها را جدا از متن می‌فرستد.

بدون `GuildMembers`، bisim.js هنگام اتصال فهرست اعضا را بارگذاری نمی‌کند: عضویت خود ربات بارگذاری می‌شود و
اعضایی که ربات با آن‌ها روبه‌رو می‌شود (مثلاً نویسندگان پیام‌ها) همان وقت در حافظهٔ موقت می‌آیند.
`guild.members.fetch()` با یک شناسه یا یک `query` کار می‌کند؛ گرفتن همهٔ اعضا به روشن بودن این اینتنت نیاز دارد
و در غیر این صورت با `MissingIntent` رد می‌شود.

بدون `GuildPresences` هیچ وضعیتی (presence) نمی‌رسد و `guild.presences.cache` خالی می‌ماند.

### وقتی اینتنت‌ها پذیرفته نشوند

بی‌سیم اینتنت‌ها را هنگام اتصال بررسی می‌کند و اگر نپذیرد، مثل دیسکورد اتصال را می‌بندد:

- **4013**، اینتنتی که دیسکورد تعریف نکرده است: `login()` با یک `BisimjsError` با کد `InvalidIntents` رد
  می‌شود.
- **4014**، اینتنت ویژه‌ای که روشن نیست (یا از ۱۰۰ سرور به بالا تأیید نشده است): `login()` با
  `DisallowedIntents` رد می‌شود.

bisim.js پس از هیچ‌کدام دوباره وصل نمی‌شود. اگر این در یک اتصال دوبارهٔ بعدی رخ دهد، کلاینت `ShardDisconnect`
را با همان کد و خطا را به‌صورت `Error` منتشر می‌کند و قطع می‌ماند.

```js
client.login(process.env.BISIM_TOKEN).catch((error) => {
  if (error.code === 'DisallowedIntents') console.error('Switch the intent on in the Developer Portal.');
  else throw error;
});
```

## حالت نیمه‌کامل (partials)

حالت نیمه‌کامل مثل discord.js کار می‌کند. بدون آن، رویدادهای مربوط به پیام‌ها، واکنش‌ها و اعضایی که در حافظهٔ
موقت نیستند کنار گذاشته می‌شوند؛ با آن، bisim.js یک شیء نیمه‌کامل منتشر می‌کند که می‌توانید با `fetch()` کاملش کنید:

```js
const { Client, GatewayIntentBits, Partials } = require('bisim.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
```

## اتصال دوباره

اتصال‌ها گاهی قطع می‌شوند: یک اختلال در شبکه، یا راه‌اندازی دوبارهٔ گیت‌وی بی‌سیم. bisim.js خودش دوباره وصل
می‌شود؛ با فاصله‌ای تصادفی که میان هر تلاش بیشتر می‌شود (از یک تا سی ثانیه)، یا بلافاصله اگر گیت‌وی بخواهد.
بی‌سیم ادامهٔ اتصال قبلی (resume) ندارد، پس bisim.js پس از اتصال دوباره سرورها را از نو بارگذاری می‌کند،
تغییرهایی را که پیدا کند منتشر می‌کند (`GuildCreate`، `GuildDelete`، `ChannelCreate`، `GuildRoleUpdate` و مانند
آن‌ها) و سپس `ShardResume` را.

وقتی بی‌سیم اشتراک ربات در یک سرور را قطع کند (چون دسترسی‌ها یا کانال‌هایش تغییر کرده است)، bisim.js آن سرور را
تازه می‌کند، تغییرها را منتشر می‌کند و دوباره مشترک می‌شود. سروری که ربات از آن بیرون شده باشد `GuildDelete`
منتشر می‌کند.

## چه چیزهایی هنگام اتصال بارگذاری می‌شود

ایموجی‌ها و وضعیت‌های صوتی برای همهٔ سرورها بارگذاری می‌شوند، و اگر کلاینت اینتنت `GuildMembers` را داشته باشد
فهرست اعضا هم. برای سرورهای خیلی بزرگ می‌توانید بخشی از این کار را خاموش کنید:

```js
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  bootstrap: { members: false, emojis: true, voiceStates: true, concurrency: 4 },
});
```

بدون فهرست اعضا، `guild.members.cache` فقط با خود ربات شروع می‌شود و با دیده شدن اعضا پر می‌شود؛ هر وقت لازم
داشتید اعضا را بگیرید.

## محدودیت نرخ درخواست

بی‌سیم به هر ربات اجازهٔ ۶۰۰ درخواست در دقیقه و ۵ پیام در هر ۵ ثانیه برای هر کانال را می‌دهد. هر پاسخ با
سرآیندهای دیسکورد می‌گوید ربات کجای محدودیت است: `X-RateLimit-Limit`، `-Remaining`، `-Reset`، `-Reset-After` و
`-Bucket`. bisim.js درخواست‌های هر مسیر را به ترتیب می‌فرستد، یاد می‌گیرد هر مسیر در کدام سطل (bucket) است، و
وقتی سهم یک سطل تمام شده باشد به جای فرستادن تا زمان تازه شدن آن صبر می‌کند. اگر بی‌سیم باز هم ۴۲۹ بدهد، همان
قدر که بی‌سیم می‌گوید صبر می‌کند، و اگر محدودیت سهم کل ربات باشد همهٔ مسیرها را نگه می‌دارد. خطاهای سرور و شبکه
دوباره امتحان می‌شوند.

```js
client.rest.on('rateLimited', (info) => console.log(`${info.route}: waiting ${info.timeToReset}ms (${info.hash})`));
```

با `rest.options.rejectOnRateLimit` درخواست محدودشده به جای صبر کردن با `RateLimitError` شکست می‌خورد.

## شاردینگ

بی‌سیم شاردینگ ندارد: یک اتصال همه‌چیز را می‌آورد. رویدادهای شارد (`ShardReady`، `ShardResume`،
`ShardReconnecting`، `ShardDisconnect`) همچنان منتشر می‌شوند، همیشه برای شارد ۰، و `ShardingManager` وجود ندارد.

## عیب‌یابی

```js
client.on(Events.Debug, console.log);
client.on(Events.Warn, console.warn);
client.on(Events.Raw, (packet) => console.log(packet.t));
```
