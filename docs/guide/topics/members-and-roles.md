# Members and roles

## Members

With the `GuildMembers` intent, bisim.js loads every server's members when it connects, so
`guild.members.cache` is full from `ClientReady` on, and member events keep it current. Without it, the cache
holds the bot and the members it has met, such as the authors of messages. You can also fetch them:

```js
const member = await guild.members.fetch('123456789012345678');
const everyone = await guild.members.fetch();
const found = await guild.members.search({ query: 'ali', limit: 10 });
const me = guild.members.me; // the bot itself
```

Fetching every member needs the Server Members intent switched on for the app in the Developer Portal;
otherwise `guild.members.fetch()` rejects with `MissingIntent`. One member and a search work without it.

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

To ban many at once (up to 200, with Ban Members and Manage Server):

```js
const { bannedUsers, failedUsers } = await guild.bans.bulkCreate(ids, { deleteMessageSeconds: 3600, reason: 'Raid' });
```

`failedUsers` lists those Bisim would not ban, such as the owner or someone above the bot. When nobody could
be banned, Bisim answers with the error `BULK_BAN_FAILED`.

Every `reason` reaches the server's audit log: bisim.js sends it in Discord's `X-Audit-Log-Reason` header,
which Bisim reads on every route.

## AutoMod

With Manage Server a bot reads and writes the server's AutoMod rules, in discord.js's words:

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

The triggers are `Keyword`, `KeywordPreset` (Bisim's word lists, `Profanity`, `SexualContent` and `Slurs`),
`Spam`, `MentionSpam` and `MemberProfile` (names and nicknames, with the `MemberUpdate` event type). The
actions are `BlockMessage`, `SendAlertMessage` and `Timeout`. A rule keeps its trigger and its event type
once made; mention raid protection and `BlockMemberInteraction` are not on Bisim and throw.

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

A bot sees who is in a voice channel and can moderate them (to join voice itself, see [Voice](../voice/index.md)):

```js
const voice = member.voice;
if (voice.channel) {
  await voice.setMute(true, 'Too loud');
  await voice.setChannel(otherVoiceChannel);
  await voice.disconnect();
}
```
