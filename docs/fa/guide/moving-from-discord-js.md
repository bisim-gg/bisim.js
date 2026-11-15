# آمدن از discord.js

bisim.js از نزدیک از discord.js نسخهٔ ۱۴ پیروی می‌کند، پس بیشتر ربات‌ها با تغییر دو چیز منتقل می‌شوند.

## دو تغییر

1. بخش import:

   ```diff
   - const { Client, Events, GatewayIntentBits } = require('discord.js');
   + const { Client, Events, GatewayIntentBits } = require('bisim.js');
   ```

2. توکن: در پورتال توسعه‌دهندگان یک برنامه بسازید (در بی‌سیم **تنظیمات**، **پورتال توسعه‌دهندگان**، یا
   [bisim.gg/developers](https://bisim.gg/developers)) و از توکن آن استفاده کنید. دستورها را دوباره با اسکریپت ثبت
   دستورها ثبت کنید؛ بی‌سیم فهرست دستورهای خودش را نگه می‌دارد.

## تنها قاعدهٔ تغییر نام

نام‌ها همان نام‌های discord.js هستند. فقط واژهٔ «Discord» به «Bisim» تبدیل می‌شود:

| discord.js | bisim.js |
| --- | --- |
| `DiscordAPIError` | `BisimAPIError` |
| `DiscordjsError`، `DiscordjsTypeError`، `DiscordjsRangeError` | `BisimjsError`، `BisimjsTypeError`، `BisimjsRangeError` |
| `DiscordjsErrorCodes` | `ErrorCodes` |
| `discordSort` | `bisimSort` |
| `DiscordSnowflake` | `BisimSnowflake` (و `SnowflakeUtil` با مبدأ زمانی بی‌سیم) |
| `DISCORD_TOKEN` که `login()` می‌خواند | `BISIM_TOKEN` |

همهٔ نام‌های دیگر همان می‌مانند: `Client`، `Events`، `SlashCommandBuilder`، `EmbedBuilder`، `PermissionFlagsBits`،
`Collection` و بقیه.

## چیزهایی که در بی‌سیم نیست

این امکانات در بی‌سیم وجود ندارند. bisim.js هیچ‌کدام را بی‌صدا نادیده نمی‌گیرد: استفاده از آن‌ها یک `BisimjsError`
با کد `NotSupported` می‌دهد که پیامش نام همان امکان را می‌گوید.

| امکان | چه چیزی خطا می‌دهد |
| --- | --- |
| رشته‌ها (threads) | `Routes.threads()`، `message.startThread()`، `channel.threads` |
| کانال‌های استیج | `voiceState.setRequestToSpeak()`، `setSuppressed()`، `guild.stageInstances` |
| کانال‌های انجمن، رسانه و اطلاع‌رسانی | `message.crosspost()`، `guild.channels.addFollower()`، `textChannel.setType()` |
| رویدادهای زمان‌بندی‌شده | `guild.scheduledEvents` |
| شاردینگ | `ShardingManager` وجود ندارد؛ هر `shards` به‌جز ۰ خطای `ClientInvalidProvidedShards` می‌دهد |
| دسترسی‌های جداگانهٔ دستورها | `command.permissions`، `commands.permissions.set()` |
| بستهٔ استیکر، SKU، اشتراک و دکمهٔ پریمیوم | `client.fetchStickerPacks()`، `application.fetchSKUs()`، `ButtonStyle.Premium` |
| ویجت، پیش‌نمایش، آشنایی اولیه، صفحهٔ خوش‌آمد و یکپارچه‌سازی‌های سرور | متدهای `guild.fetch...()` مربوط |
| آیکون، بنر و تصویر خوش‌آمد سرور از راه API | `guild.setIcon()`، `guild.setBanner()`، `guild.setSplash()` |
| برچسب در فرم‌ها | `addLabelComponents()` |
| ایموجی محدود به نقش، توضیح و برچسب استیکر | `emoji.edit({ roles })`، `sticker.edit({ description, tags })` |
| ایموجی سفارشی روی صداهای ساندبورد | `guild.soundboardSounds.create({ emojiId })` |
| محافظت از هجوم اشاره، مسدود کردن تعامل اعضا و تغییر نوع رویداد یک قانون اتومد | `setMentionRaidProtectionEnabled(true)`، `AutoModerationActionType.BlockMemberInteraction`، `rule.setEventType()` |
| تغییر نوع، بیت‌ریت، سقف کاربر یا منطقهٔ کانال | متدهای `channel.set...()` مربوط |

## اینتنت‌ها

اینتنت‌ها مثل دیسکورد کار می‌کنند: ربات رویدادهایی را دریافت می‌کند که اینتنت‌هایش در بر می‌گیرند، و اینتنت‌های
ویژه (`GuildMembers`، `GuildPresences`، `MessageContent`) باید در پرتال توسعه‌دهندگان روشن شوند
([bisim.gg/developers](https://bisim.gg/developers)، برنامهٔ شما، **Bot**، **Privileged Gateway Intents**)؛
وگرنه `login()` با `DisallowedIntents` رد می‌شود. اگر ربات شما متن پیام‌ها را می‌خواند، `MessageContent` را در
اینتنت‌هایش نگه دارید و روشنش کنید. صفحهٔ [گیت‌وی و اینتنت‌ها](./topics/gateway.md) را ببینید.

## پذیرفته می‌شوند ولی اثری ندارند

- `allowedMentions.repliedUser` پذیرفته می‌شود؛ در بی‌سیم پاسخ دادن به پیام کسی را صدا نمی‌زند.
- `avatarURL` روی یک پیام وب‌هوک با یک هشدار نادیده گرفته می‌شود: بی‌سیم تصویر فرستنده را از جای دیگری نشان
  نمی‌دهد. به خود وب‌هوک با `webhook.edit({ avatar })` تصویر بدهید.
- `setAFK()`، مثل ربات‌ها در دیسکورد، تغییر دیدنی‌ای ایجاد نمی‌کند.
- `tts` با یک هشدار نادیده گرفته می‌شود.

## رفتارهای کمی متفاوت

- **`ClientReady`** پس از آن می‌آید که bisim.js همهٔ سرورها را بارگذاری کرده باشد (اگر کلاینت اینتنت
  `GuildMembers` را داشته باشد، همراه فهرست اعضا). با نام `ready` هم منتشر می‌شود.
- **تصویرهای امبد** (تصویر بزرگ، تصویر کوچک، آیکون نویسنده و پانویس) پیوند `http` یا `https` هستند، یا
  `attachment://name` برای فایلی که همراه همان پیام فرستاده یا نگه داشته می‌شود. `attachment://` که نام هیچ
  فایلی از پیام نباشد کنار گذاشته می‌شود و یک بار هشدار داده می‌شود.
- **فایل‌ها** حتی وقتی امبدی نشانشان می‌دهد در `message.attachments` می‌مانند؛ برنامه‌های بی‌سیم، مثل دیسکورد،
  چنین فایلی را در فهرست نشان نمی‌دهند.
- **کد خطاهای بی‌سیم** نام هستند، مثل `BOT_NOT_ALLOWED` یا `RATE_LIMITED`، نه عددهای دیسکورد. `error.code` را با
  همین نام‌ها مقایسه کنید یا از `error.status` استفاده کنید.
- **ردیف‌های گزارش ممیزی** در `entry.action` عددهای `AuditLogEvent` دیسکورد را دارند؛ نام خود بی‌سیم برای آن
  کار (`MEMBER_BAN` و مانند آن) در `entry.actionName` است.
- **رویدادهایی که هرگز رخ نمی‌دهند**، چون بی‌سیم چیزی برای گزارششان ندارد: `GuildMembersChunk`،
  `GuildIntegrationsUpdate` و رویدادهای رشته‌ها، استیج‌ها، رویدادهای زمان‌بندی‌شده و اشتراک‌ها.
- **پیوندها.** پیوند پیام‌ها `https://bisim.gg/channels/...` است، پیوند دعوت `https://bisim.gg/<code>`، و پیوند
  افزودنی که `generateInvite()` می‌سازد `https://bisim.gg/oauth2/authorize?...`.
- **شناسه‌ها (snowflake)** از مبدأ زمانی بی‌سیم حساب می‌شوند، پس `SnowflakeUtil.timestampFrom(id)` برای شناسه‌های
  بی‌سیم تاریخ درست را می‌دهد.
- **زبان‌ها.** ترجمه‌های دستورها فقط `fa` و انگلیسی را نگه می‌دارند و زبان‌های دیگر کنار گذاشته می‌شوند.

## صدا

صدا مثل دیسکورد بستهٔ جداگانهٔ خودش را دارد: `@bisim/voice` با همان API جای `@discordjs/voice` را می‌گیرد و
`guild.voiceAdapterCreator` مثل قبل کار می‌کند. ربات فقط صدا می‌فرستد و در هر سرور در یک کانال صوتی می‌نشیند.
صفحهٔ [صدا](./voice/index.md) را ببینید.

## امکانات اضافهٔ بی‌سیم

- `client.handleInteraction()` برای ربات‌هایی که [نشانی دستورها](./interactions/interactions-url.md) دارند.
- `channel.permissionOverwrites.fetch()`، چون بی‌سیم دسترسی‌های کانال را در صورت درخواست می‌فرستد.
- گزینهٔ `bootstrap` در تنظیمات کلاینت، برای انتخاب چیزهایی که هنگام اتصال بارگذاری می‌شوند.
- `PermissionFlagsBits.PokeMembers`، دسترسی مخصوص بی‌سیم.

## فهرست کارها

- [ ] بخش import را عوض کنید.
- [ ] برنامه را در بی‌سیم بسازید و `BISIM_TOKEN` را تنظیم کنید.
- [ ] اسکریپت ثبت دستورها را اجرا کنید.
- [ ] کدتان را برای امکانات جدول بالا جستجو کنید.
- [ ] اگر `error.code` را با عددهای دیسکورد مقایسه می‌کنید، به نام‌های بی‌سیم یا `error.status` تغییرش دهید.
- [ ] ربات را روشن کنید و هر دستور را یک بار امتحان کنید.
