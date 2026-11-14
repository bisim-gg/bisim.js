# اعضا و نقش‌ها

## اعضا

bisim.js هنگام اتصال، اعضای همهٔ سرورها را بارگذاری می‌کند، پس `guild.members.cache` از لحظهٔ `ClientReady`
پر است. می‌توانید اعضا را جداگانه هم بگیرید:

```js
const member = await guild.members.fetch('123456789012345678');
const everyone = await guild.members.fetch();
const found = await guild.members.search({ query: 'ali', limit: 10 });
const me = guild.members.me; // the bot itself
```

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

ربات‌ها در بی‌سیم نمی‌توانند وارد کانال صوتی شوند، اما می‌توانند ببینند چه کسی در کانال صوتی است و آن‌ها را
مدیریت کنند:

```js
const voice = member.voice;
if (voice.channel) {
  await voice.setMute(true, 'Too loud');
  await voice.setChannel(otherVoiceChannel);
  await voice.disconnect();
}
```
