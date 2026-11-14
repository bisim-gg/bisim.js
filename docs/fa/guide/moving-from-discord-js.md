# آمدن از discord.js

bisim.js از نزدیک از discord.js نسخهٔ ۱۴ پیروی می‌کند، پس بیشتر ربات‌ها با تغییر دو چیز منتقل می‌شوند.

## دو تغییر

1. بخش import:

   ```diff
   - const { Client, Events, GatewayIntentBits } = require('discord.js');
   + const { Client, Events, GatewayIntentBits } = require('bisim.js');
   ```

2. توکن: در بی‌سیم یک برنامه بسازید (**تنظیمات**، **برنامه‌ها**) و از توکن آن استفاده کنید. دستورها را دوباره با
   اسکریپت ثبت دستورها ثبت کنید؛ بی‌سیم فهرست دستورهای خودش را نگه می‌دارد.

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
| اتصال صوتی برای ربات‌ها | ورود به کانال صوتی، `member.voice.setChannel()` روی خود ربات |
| شاردینگ | `ShardingManager` وجود ندارد؛ هر `shards` به‌جز ۰ خطای `ClientInvalidProvidedShards` می‌دهد |
| دسترسی‌های جداگانهٔ دستورها | `command.permissions`، `commands.permissions.set()` |
| بستهٔ استیکر، SKU، اشتراک و دکمهٔ پریمیوم | `client.fetchStickerPacks()`، `application.fetchSKUs()`، `ButtonStyle.Premium` |
| ویجت، پیش‌نمایش، آشنایی اولیه، صفحهٔ خوش‌آمد و یکپارچه‌سازی‌های سرور | متدهای `guild.fetch...()` مربوط |
| فایل در پاسخ تعامل‌ها و وب‌هوک‌ها | `interaction.reply({ files })`، `webhook.send({ files })` |
| ویرایش پیام‌های گذشتهٔ وب‌هوک | `webhook.editMessage()`، `fetchMessage()`، `deleteMessage()` |
| حذف همهٔ واکنش‌های یک ایموجی | `reaction.remove()` (به جای آن `reaction.users.remove()` یا `message.reactions.removeAll()`) |
| تصویر ربات، آیکون و بنر سرور از راه API | `client.user.setAvatar()`، `guild.setIcon()` |
| مقدار پیش‌فرض در منوهای انتخاب، برچسب در فرم‌ها | `setDefaultUsers()`، `addLabelComponents()` |
| تغییر نوع، بیت‌ریت، سقف کاربر یا منطقهٔ کانال | متدهای `channel.set...()` مربوط |

## پذیرفته می‌شوند ولی اثری ندارند

- `intents` اجباری است و نادیده گرفته می‌شود: ربات هر چیزی را که دسترسی‌هایش اجازه بدهند دریافت می‌کند.
- `allowedMentions` پذیرفته می‌شود؛ بی‌سیم هنوز اشاره‌ها را فیلتر نمی‌کند.
- `setAFK()`، مثل ربات‌ها در دیسکورد، تغییر دیدنی‌ای ایجاد نمی‌کند.
- `tts` با یک هشدار نادیده گرفته می‌شود.

## رفتارهای کمی متفاوت

- **`ClientReady`** پس از آن می‌آید که bisim.js همهٔ سرورها، از جمله اعضا، را بارگذاری کرده باشد. با نام `ready`
  هم منتشر می‌شود.
- **امبدها** تصویر، تصویر کوچک و آیکون نشان نمی‌دهند. سازنده آن‌ها را نگه می‌دارد و یک بار هشدار می‌دهد.
- **کد خطاهای بی‌سیم** نام هستند، مثل `BOT_NOT_ALLOWED` یا `RATE_LIMITED`، نه عددهای دیسکورد. `error.code` را با
  همین نام‌ها مقایسه کنید یا از `error.status` استفاده کنید.
- **رویدادهای کانال و بن.** ساخته شدن یا حذف شدن کانال‌ها از راه تازه‌سازی سرور فهمیده می‌شود، پس `ChannelCreate`
  و `ChannelDelete` همچنان منتشر می‌شوند. `GuildBanAdd`، `GuildBanRemove`، `InviteCreate` و `InviteDelete` هرگز
  منتشر نمی‌شوند.
- **پیوندها.** پیوند پیام‌ها `https://bisim.gg/channels/...` است، پیوند دعوت `https://bisim.gg/<code>`، و پیوند
  افزودنی که `generateInvite()` می‌سازد `https://bisim.gg/oauth2/authorize?...`.
- **شناسه‌ها (snowflake)** از مبدأ زمانی بی‌سیم حساب می‌شوند، پس `SnowflakeUtil.timestampFrom(id)` برای شناسه‌های
  بی‌سیم تاریخ درست را می‌دهد.
- **زبان‌ها.** ترجمه‌های دستورها فقط `fa` و انگلیسی را نگه می‌دارند و زبان‌های دیگر کنار گذاشته می‌شوند.

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
