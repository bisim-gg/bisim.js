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
| `MessagePollVoteAdd`، `MessagePollVoteRemove` | `answer`، `userId` |
| `InteractionCreate` | `interaction` |
| `GuildCreate`، `GuildDelete` | `guild` |
| `GuildUpdate` | `oldGuild`، `newGuild` |
| `GuildMemberAdd`، `GuildMemberRemove` | `member` |
| `GuildMemberUpdate` | `oldMember`، `newMember` |
| `ChannelCreate`، `ChannelDelete` | `channel` |
| `ChannelUpdate` | `oldChannel`، `newChannel` |
| `ChannelPinsUpdate` | `channel`، `date` |
| `GuildRoleCreate`، `GuildRoleDelete` | `role` |
| `GuildRoleUpdate` | `oldRole`، `newRole` |
| `GuildEmojiCreate`، `GuildEmojiDelete` | `emoji` |
| `GuildStickerCreate`، `GuildStickerDelete` | `sticker` |
| `PresenceUpdate` | `oldPresence`، `newPresence` |
| `TypingStart` | `typing` |
| `VoiceStateUpdate` | `oldState`، `newState` |
| `UserUpdate` | `oldUser`، `newUser` |
| `ShardReady`، `ShardResume`، `ShardReconnecting`، `ShardDisconnect`، `ShardError` | چرخهٔ عمر اتصال |
| `Debug`، `Warn`، `Error`، `Raw` | عیب‌یابی |

`ClientReady` با نام قدیمی‌ترش، `ready`، هم منتشر می‌شود تا هر دو شکل نوشتن کار کنند.

## تفاوت‌ها در بی‌سیم

- **`ClientReady` را bisim.js می‌سازد.** بی‌سیم رویداد READY ندارد؛ bisim.js همهٔ سرورها را بارگذاری می‌کند و
  بعد `ClientReady` را یک بار منتشر می‌کند. پس از اتصال دوباره، به جای آن `ShardResume` می‌آید.
- **ساخته شدن و حذف شدن کانال‌ها** از راه تازه‌سازی سرور فهمیده می‌شود: bisim.js سرور را پیش و پس از تغییر
  مقایسه می‌کند و `ChannelCreate`، `ChannelUpdate` و `ChannelDelete` را منتشر می‌کند.
- **هرگز منتشر نمی‌شوند**، چون بی‌سیم منبعی برایشان ندارد: `GuildBanAdd`، `GuildBanRemove`، `InviteCreate`،
  `InviteDelete`، `GuildMembersChunk` و همهٔ رویدادهای رشته‌ها، استیج‌ها، رویدادهای زمان‌بندی‌شده و اشتراک‌ها.
- **پیام‌هایی که در حافظه نیستند.** ویرایش، حذف یا واکنش روی پیامی که ربات در حافظهٔ موقت ندارد، فقط وقتی
  منتشر می‌شود که مثل discord.js حالت نیمه‌کامل (partial) مربوط را فعال کنید:
  `new Client({ partials: [Partials.Message] })`.

## خطاها

وقتی یک کنترل‌کننده خطا می‌دهد، گرفتن آن با خودتان است: مثل کنترل‌کنندهٔ دستورها، بدنه را در `try` و `catch`
بگذارید. مشکلات داخلی‌ای که bisim.js خودش از آن‌ها عبور می‌کند به‌صورت `Warn` گزارش می‌شوند، یا اگر به `Error`
گوش بدهید به‌صورت `Error`؛ پس رباتی که برای خطاها شنونده ندارد از کار نمی‌افتد.
