# رویدادها

کلاینت یک منتشرکنندهٔ رویداد (event emitter) است. رویدادهای بی‌سیم با همان نام‌ها و ورودی‌های discord.js
می‌رسند، پس `client.on(Events.MessageCreate, (message) => {})` همان‌طور که انتظار دارید کار می‌کند.

## هر رویداد در یک فایل

رویدادها هم مثل دستورها می‌توانند فایل خودشان را داشته باشند:

```js
// events/ready.js
const { Events } = require('bisim.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`${client.user.tag} is online.`);
  },
};
```

```js
// events/interactionCreate.js
const { Events } = require('bisim.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    await interaction.client.commands.get(interaction.commandName)?.execute(interaction);
  },
};
```

```js
// index.js
const eventsDir = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsDir).filter((name) => name.endsWith('.js'))) {
  const { name, once, execute } = require(path.join(eventsDir, file));
  client[once ? 'once' : 'on'](name, (...args) => execute(...args));
}
```

## فهرست رویدادها

| رویداد | ورودی‌ها |
| --- | --- |
| `ClientReady` | `client` |
| `MessageCreate` | `message` |
| `MessageUpdate` | `oldMessage`، `newMessage` |
| `MessageDelete` | `message` |
| `MessageBulkDelete` | `messages`، `channel` |
| `MessageReactionAdd`، `MessageReactionRemove` | `reaction`، `user`، `details` |
| `MessageReactionRemoveAll` | `message`، `reactions` |
| `MessageReactionRemoveEmoji` | `reaction` |
| `MessagePollVoteAdd`، `MessagePollVoteRemove` | `answer`، `userId` |
| `InteractionCreate` | `interaction` |
| `GuildCreate`، `GuildDelete` | `guild` |
| `GuildUpdate` | `oldGuild`، `newGuild` |
| `GuildMemberAdd`، `GuildMemberRemove` | `member` |
| `GuildMemberUpdate` | `oldMember`، `newMember` |
| `GuildBanAdd`، `GuildBanRemove` | `ban` (نیمه‌کامل: برای دلیل بن آن را `fetch()` کنید) |
| `GuildAuditLogEntryCreate` | `entry`، `guild` |
| `InviteCreate`، `InviteDelete` | `invite` |
| `WebhooksUpdate` | `channel` |
| `AutoModerationRuleCreate`، `AutoModerationRuleDelete` | `rule` |
| `AutoModerationRuleUpdate` | `oldRule`، `newRule` |
| `AutoModerationActionExecution` | `execution` |
| `ChannelCreate`، `ChannelDelete` | `channel` |
| `ChannelUpdate` | `oldChannel`، `newChannel` |
| `ChannelPinsUpdate` | `channel`، `date` |
| `GuildRoleCreate`، `GuildRoleDelete` | `role` |
| `GuildRoleUpdate` | `oldRole`، `newRole` |
| `GuildEmojiCreate`، `GuildEmojiDelete` | `emoji` |
| `GuildEmojiUpdate` | `oldEmoji`، `newEmoji` |
| `GuildStickerCreate`، `GuildStickerDelete` | `sticker` |
| `GuildStickerUpdate` | `oldSticker`، `newSticker` |
| `PresenceUpdate` | `oldPresence`، `newPresence` |
| `TypingStart` | `typing` |
| `VoiceStateUpdate` | `oldState`، `newState` |
| `GuildSoundboardSoundCreate`، `GuildSoundboardSoundDelete` | `sound` |
| `GuildSoundboardSoundUpdate` | `oldSound`، `newSound` |
| `VoiceChannelEffectSend` | `effect` (صدای ساندبوردی که در کانال صوتی پخش شد) |
| `VoiceServerUpdate` | `data` (ورود ربات به کانال صوتی، از @bisim/voice) |
| `UserUpdate` | `oldUser`، `newUser` |
| `ShardReady`، `ShardResume`، `ShardReconnecting`، `ShardDisconnect`، `ShardError` | چرخهٔ عمر اتصال |
| `Debug`، `Warn`، `Error`، `Raw` | عیب‌یابی |

`ClientReady` با نام قدیمی‌ترش، `ready`، هم منتشر می‌شود تا هر دو شکل نوشتن کار کنند، و `WebhooksUpdate` با
نام منسوخ `webhookUpdate`.

اینکه ربات کدام‌یک از این رویدادها را دریافت کند، مثل دیسکورد به اینتنت‌هایش بستگی دارد: صفحهٔ
[گیت‌وی و اینتنت‌ها](./gateway.md) را ببینید.

## تفاوت‌ها در بی‌سیم

- **`ClientReady` را bisim.js می‌سازد.** بی‌سیم رویداد READY ندارد؛ bisim.js همهٔ سرورها را بارگذاری می‌کند و
  بعد `ClientReady` را یک بار منتشر می‌کند. پس از اتصال دوباره، به جای آن `ShardResume` می‌آید.
- **تازه‌سازی سرور.** وقتی بی‌سیم از bisim.js بخواهد سروری را دوباره بارگذاری کند (دسترسی‌های ربات تغییر
  کرده است)، bisim.js سرور را پیش و پس از آن مقایسه می‌کند و تغییرها را منتشر می‌کند، از جمله `ChannelUpdate`
  و رویدادهای نقش‌ها. ساخته شدن یا حذف شدن یک کانال فقط یک بار منتشر می‌شود، چه رویداد خودش زودتر برسد و چه
  تازه‌سازی.
- **ردیف‌های گزارش ممیزی** عددهای دیسکورد را دارند: `entry.action === AuditLogEvent.MemberBanAdd` کار
  می‌کند و نام خود بی‌سیم برای آن کار در `entry.actionName` است.
- **هرگز منتشر نمی‌شوند**، چون بی‌سیم منبعی برایشان ندارد: `GuildMembersChunk`، `GuildIntegrationsUpdate`،
  `GuildAvailable`، `GuildUnavailable`، `ApplicationCommandPermissionsUpdate`، `CacheSweep` و همهٔ رویدادهای
  رشته‌ها، استیج‌ها، رویدادهای زمان‌بندی‌شده و اشتراک‌ها.
- **پیام‌ها و اعضایی که در حافظه نیستند.** ویرایش، حذف یا واکنش روی پیامی که ربات در حافظهٔ موقت ندارد، یا
  رفتن عضوی که در حافظه نیست، فقط وقتی منتشر می‌شود که مثل discord.js حالت نیمه‌کامل (partial) مربوط را فعال
  کنید: `new Client({ partials: [Partials.Message, Partials.GuildMember] })`. عضوی که می‌رود همراه کاربرش
  می‌آید، پس حتی عضو نیمه‌کامل هم `member.user` دارد.

## خطاها

وقتی یک کنترل‌کننده خطا می‌دهد، گرفتن آن با خودتان است: مثل کنترل‌کنندهٔ دستورها، بدنه را در `try` و `catch`
بگذارید. مشکلات داخلی‌ای که bisim.js خودش از آن‌ها عبور می‌کند به‌صورت `Warn` گزارش می‌شوند، یا اگر به `Error`
گوش بدهید به‌صورت `Error`؛ پس رباتی که برای خطاها شنونده ندارد از کار نمی‌افتد.
