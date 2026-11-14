# Permissions

## Who can use a command

`setDefaultMemberPermissions()` hides a command from members who do not have all the given permissions.
Bisim uses Discord's permission bits, so the values are the ones you know.

```js
const { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('bisim.js');

const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Times a member out for ten minutes')
  .addUserOption((option) => option.setName('member').setDescription('Who to time out').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);
```

- `setDefaultMemberPermissions(0)` shows the command only to administrators.
- Combine permissions with `|`: `PermissionFlagsBits.KickMembers | PermissionFlagsBits.BanMembers`.
- Administrators see every command.

Bisim also checks that the member has the **Use Application Commands** permission in the channel, and that
they are not timed out.

## Where a command can run

Bisim runs commands in servers and in the bot's own DMs. Limit a command to one of them with `setContexts()`:

```js
const { InteractionContextType } = require('bisim.js');

new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Information about this server')
  .setContexts(InteractionContextType.Guild);
```

`InteractionContextType.Guild` and `InteractionContextType.BotDM` are the two contexts Bisim has. The older
`setDMPermission(false)` still works and means the same as the server context alone.

## Checking permissions in code

The default permissions are a first filter that server admins can rely on. For anything sensitive, check
in your code too:

```js
async function execute(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({ content: 'You cannot time members out.', flags: MessageFlags.Ephemeral });
  }
  if (!interaction.appPermissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({ content: 'I need the Timeout Members permission.', flags: MessageFlags.Ephemeral });
  }
  const member = interaction.options.getMember('member');
  if (!member?.moderatable) {
    return interaction.reply({ content: 'I cannot time that member out.', flags: MessageFlags.Ephemeral });
  }
  await member.timeout(10 * 60 * 1000, `Requested by ${interaction.user.username}`);
  await interaction.reply(`${member.displayName} is timed out for ten minutes.`);
}
```

- `interaction.memberPermissions` is what the member can do in the channel.
- `interaction.appPermissions` is what your bot can do there.
- `member.bannable`, `kickable`, `manageable` and `moderatable` compare role positions as Bisim does.
