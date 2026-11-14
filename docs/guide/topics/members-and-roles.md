# Members and roles

## Members

bisim.js loads every server's members when it connects, so `guild.members.cache` is full from
`ClientReady` on. You can also fetch them:

```js
const member = await guild.members.fetch('123456789012345678');
const everyone = await guild.members.fetch();
const found = await guild.members.search({ query: 'ali', limit: 10 });
const me = guild.members.me; // the bot itself
```

A `GuildMember` has `user`, `nickname`, `displayName`, `joinedAt`, `roles`, `permissions`, `voice` and
`presence`.

## Moderating

```js
await member.setNickname('New name', 'Requested');
await member.timeout(10 * 60 * 1000, 'Spamming'); // ten minutes
await member.disableCommunicationDisabled();
await member.kick('Breaking the rules');
await member.ban({ deleteMessageSeconds: 60 * 60 * 24, reason: 'Spam' });
await guild.members.unban('123456789012345678');
```

Bisim enforces the role hierarchy like Discord: the bot can act only on members below its highest role, and
needs the matching permission. Check first with `member.kickable`, `bannable`, `moderatable` and
`manageable`.

## Roles

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

`member.roles.cache` holds a member's roles (`@everyone` included), `member.roles.highest` the highest one.
`guild.roles.everyone` is the `@everyone` role, whose id is the server's id.

## Permissions

Bisim uses Discord's permission bits, so `PermissionFlagsBits` and `PermissionsBitField` work as in
discord.js:

```js
if (member.permissions.has(PermissionFlagsBits.ManageGuild)) {
  // a server manager
}

const inChannel = member.permissionsIn(channel);
console.log(inChannel.toArray());
```

`has()` treats Administrator as every permission unless you pass `false` as the second argument.

Bisim adds one bit of its own, `PermissionFlagsBits.PokeMembers`.

## Channel overwrites

```js
await channel.permissionOverwrites.create(guild.roles.everyone, { SendMessages: false });
await channel.permissionOverwrites.edit(role, { SendMessages: true });
await channel.permissionOverwrites.delete(role);
```

Bisim sends a channel's overwrites on request rather than with the server. `channel.permissionsFor(member)`
uses Bisim's own calculation for the bot; for other members, load the overwrites first so they count:

```js
await channel.permissionOverwrites.fetch();
const canSpeak = channel.permissionsFor(member).has(PermissionFlagsBits.SendMessages);
```

## Voice

Bots cannot join voice on Bisim, but they can see who is in a voice channel and moderate them:

```js
const voice = member.voice;
if (voice.channel) {
  await voice.setMute(true, 'Too loud');
  await voice.setChannel(otherVoiceChannel);
  await voice.disconnect();
}
```
