# اعضا و نقش‌ها

## اعضا

با اینتنت `GuildMembers`، bisim.js هنگام اتصال اعضای همهٔ سرورها را بارگذاری می‌کند، پس `guild.members.cache`
از لحظهٔ `ClientReady` پر است و رویدادهای اعضا آن را به‌روز نگه می‌دارند. بدون آن، حافظهٔ موقت خود ربات و اعضایی
را نگه می‌دارد که ربات با آن‌ها روبه‌رو شده است، مثل نویسندگان پیام‌ها. می‌توانید اعضا را جداگانه هم بگیرید:

```js
const member = await guild.members.fetch('123456789012345678');
const everyone = await guild.members.fetch();
const found = await guild.members.search({ query: 'ali', limit: 10 });
const me = guild.members.me; // the bot itself
```

گرفتن همهٔ اعضا به این نیاز دارد که اینتنت Server Members برای برنامه در پرتال توسعه‌دهندگان روشن باشد؛ وگرنه
`guild.members.fetch()` با `MissingIntent` رد می‌شود. گرفتن یک عضو و جست‌وجو بدون آن هم کار می‌کنند.

هر `GuildMember` این‌ها را دارد: `user`، `nickname`، `displayName`، `joinedAt`، `roles`، `permissions`، `voice` و
`presence`.

## مدیریت اعضا

```js
await member.setNickname('New name', 'Requested');
await member.timeout(10 * 60 * 1000, 'Spamming'); // ten minutes
await member.disableCommunicationDisabled();
await member.kick('Breaking the rules');
await member.ban({ deleteMessageSeconds: 60 * 60 * 24, reason: 'Spam' });
await guild.members.unban('123456789012345678');
```

بی‌سیم مثل دیسکورد سلسله‌مراتب نقش‌ها را رعایت می‌کند: ربات فقط روی اعضایی که پایین‌تر از بالاترین نقش آن‌اند
می‌تواند کاری انجام دهد و دسترسی مربوط را هم لازم دارد. پیش از هر کار با `member.kickable`، `bannable`،
`moderatable` و `manageable` بررسی کنید.

برای بن کردن چند نفر با هم (تا ۲۰۰ نفر، با دسترسی‌های Ban Members و Manage Server):

```js
const { bannedUsers, failedUsers } = await guild.bans.bulkCreate(ids, { deleteMessageSeconds: 3600, reason: 'Raid' });
```

`failedUsers` کسانی را نشان می‌دهد که بی‌سیم بن نکرد، مثل مالک سرور یا کسی که بالاتر از ربات است. اگر هیچ‌کس بن
نشود، بی‌سیم خطای `BULK_BAN_FAILED` می‌دهد.

هر `reason` به گزارش ممیزی سرور می‌رسد: bisim.js آن را در سرآیند `X-Audit-Log-Reason` دیسکورد می‌فرستد که بی‌سیم
در همهٔ مسیرها می‌خواند.

## اتومد

ربات با دسترسی Manage Server قانون‌های اتومد سرور را، با واژه‌های discord.js، می‌خواند و می‌نویسد:

```js
const { AutoModerationActionType, AutoModerationRuleEventType, AutoModerationRuleTriggerType } = require('bisim.js');

const rule = await guild.autoModerationRules.create({
  name: 'No invite links',
  eventType: AutoModerationRuleEventType.MessageSend,
  triggerType: AutoModerationRuleTriggerType.Keyword,
  triggerMetadata: { keywordFilter: ['*discord.gg*', '*bisim.gg/*'] },
  actions: [
    { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: 'No invites here.' } },
    { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: modLog } },
  ],
  exemptRoles: [moderators],
});

await rule.setEnabled(false);
const rules = await guild.autoModerationRules.fetch();
await rule.delete();
```

ماشه‌ها `Keyword`، `KeywordPreset` (فهرست واژه‌های بی‌سیم: `Profanity`، `SexualContent` و `Slurs`)، `Spam`،
`MentionSpam` و `MemberProfile` (نام و نام مستعار اعضا، با نوع رویداد `MemberUpdate`) هستند. کارها
`BlockMessage`، `SendAlertMessage` و `Timeout` هستند. هر قانون پس از ساخته شدن ماشه و نوع رویدادش را نگه
می‌دارد؛ محافظت از هجوم اشاره و `BlockMemberInteraction` در بی‌سیم نیستند و خطا می‌دهند.

## نقش‌ها

```js
const { Colors, PermissionFlagsBits } = require('bisim.js');

const role = await guild.roles.create({
  name: 'Moderators',
  color: Colors.Blue,
  hoist: true,
  permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageMessages],
  reason: 'We needed moderators',
});

await member.roles.add(role);
await member.roles.remove(role);
await member.roles.set([role.id]); // replaces them all

await role.edit({ name: 'Mods', mentionable: true });
await role.setPosition(2);
await role.delete();
```

`member.roles.cache` نقش‌های یک عضو را نگه می‌دارد (همراه `@everyone`) و `member.roles.highest` بالاترین آن‌ها را.
`guild.roles.everyone` نقش `@everyone` است که شناسه‌اش همان شناسهٔ سرور است.

## دسترسی‌ها

بی‌سیم بیت‌های دسترسی دیسکورد را به کار می‌برد، پس `PermissionFlagsBits` و `PermissionsBitField` مثل discord.js کار
می‌کنند:

```js
if (member.permissions.has(PermissionFlagsBits.ManageGuild)) {
  // a server manager
}

const inChannel = member.permissionsIn(channel);
console.log(inChannel.toArray());
```

`has()` دسترسی مدیر کل (Administrator) را برابر همهٔ دسترسی‌ها می‌گیرد، مگر اینکه `false` را به‌عنوان ورودی دوم
بدهید.

بی‌سیم یک بیت مخصوص خودش هم دارد: `PermissionFlagsBits.PokeMembers`.

## دسترسی‌های کانال

```js
await channel.permissionOverwrites.create(guild.roles.everyone, { SendMessages: false });
await channel.permissionOverwrites.edit(role, { SendMessages: true });
await channel.permissionOverwrites.delete(role);
```

بی‌سیم دسترسی‌های اختصاصی هر کانال را جداگانه و در صورت درخواست می‌فرستد، نه همراه سرور.
`channel.permissionsFor(member)` برای خود ربات از محاسبهٔ بی‌سیم استفاده می‌کند؛ برای اعضای دیگر، اول دسترسی‌های
کانال را بارگذاری کنید تا در محاسبه بیایند:

```js
await channel.permissionOverwrites.fetch();
const canSpeak = channel.permissionsFor(member).has(PermissionFlagsBits.SendMessages);
```

## صدا

ربات می‌بیند چه کسی در کانال صوتی است و می‌تواند آن‌ها را مدیریت کند (برای ورود خود ربات به کانال صوتی،
صفحهٔ [صدا](../voice/index.md) را ببینید):

```js
const voice = member.voice;
if (voice.channel) {
  await voice.setMute(true, 'Too loud');
  await voice.setChannel(otherVoiceChannel);
  await voice.disconnect();
}
```
