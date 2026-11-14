# Select menus

A select menu takes a whole action row. Bisim has five kinds: a menu of your own options, and menus of
members, roles, users and roles together, or channels.

## A menu of your own options

```js
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('bisim.js');

const select = new StringSelectMenuBuilder()
  .setCustomId('games')
  .setPlaceholder('Pick the games you play')
  .setMaxValues(3)
  .addOptions(
    new StringSelectMenuOptionBuilder().setLabel('Chess').setDescription('Weekly tournaments').setValue('chess'),
    new StringSelectMenuOptionBuilder().setLabel('Mafia').setDescription('Voice games on weekends').setValue('mafia'),
    new StringSelectMenuOptionBuilder().setLabel('Minecraft').setDescription('Our survival server').setValue('minecraft'),
  );

await interaction.reply({ content: 'Which games do you play?', components: [new ActionRowBuilder().addComponents(select)] });
```

A menu has up to 25 options. `setMinValues()` and `setMaxValues()` let members pick several; an option can
have an emoji (`setEmoji()`) and be selected by default (`setDefault(true)`).

## Menus Bisim fills in

```js
const { ChannelSelectMenuBuilder, ChannelType, RoleSelectMenuBuilder, UserSelectMenuBuilder } = require('bisim.js');

const users = new UserSelectMenuBuilder().setCustomId('users').setPlaceholder('Select members').setMaxValues(5);
const roles = new RoleSelectMenuBuilder().setCustomId('roles').setPlaceholder('Select roles');
const channels = new ChannelSelectMenuBuilder().setCustomId('channels').addChannelTypes(ChannelType.GuildText);
```

`MentionableSelectMenuBuilder` offers users and roles together.

## Answering a choice

```js
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isStringSelectMenu() && interaction.customId === 'games') {
    await interaction.update({ content: `Noted: ${interaction.values.join(', ')}.`, components: [] });
  }

  if (interaction.isUserSelectMenu()) {
    const names = interaction.users.map((user) => user.displayName).join(', ');
    await interaction.reply(`You picked ${names}.`);
  }

  if (interaction.isRoleSelectMenu()) {
    await interaction.reply(`Roles: ${interaction.roles.map((role) => role.name).join(', ')}`);
  }

  if (interaction.isChannelSelectMenu()) {
    await interaction.reply(`Channels: ${interaction.channels.map((channel) => channel.toString()).join(' ')}`);
  }
});
```

- `interaction.values` holds the chosen values (option values, or ids for the other kinds).
- `users`, `members`, `roles` and `channels` hold the chosen objects.
- `isAnySelectMenu()` is true for every kind.

Answer with `update()`, `deferUpdate()` or `reply()`, as with [buttons](./buttons.md).

::: info Not on Bisim yet
Preselected values for the user, role and channel menus (`setDefaultUsers()` and friends) throw a
`BisimjsError`.
:::
