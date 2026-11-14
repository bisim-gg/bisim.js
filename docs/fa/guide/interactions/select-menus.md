# منوهای انتخاب

هر منوی انتخاب یک ردیف کامل را می‌گیرد. بی‌سیم پنج نوع منو دارد: منویی با گزینه‌های خودتان، و منوهای اعضا،
نقش‌ها، کاربران و نقش‌ها با هم، یا کانال‌ها.

## منویی با گزینه‌های خودتان

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

هر منو حداکثر ۲۵ گزینه دارد. با `setMinValues()` و `setMaxValues()` اعضا می‌توانند چند گزینه انتخاب کنند؛ هر
گزینه می‌تواند ایموجی داشته باشد (`setEmoji()`) و از ابتدا انتخاب‌شده باشد (`setDefault(true)`).

## منوهایی که بی‌سیم پر می‌کند

```js
const { ChannelSelectMenuBuilder, ChannelType, RoleSelectMenuBuilder, UserSelectMenuBuilder } = require('bisim.js');

const users = new UserSelectMenuBuilder().setCustomId('users').setPlaceholder('Select members').setMaxValues(5);
const roles = new RoleSelectMenuBuilder().setCustomId('roles').setPlaceholder('Select roles');
const channels = new ChannelSelectMenuBuilder().setCustomId('channels').addChannelTypes(ChannelType.GuildText);
```

`MentionableSelectMenuBuilder` کاربران و نقش‌ها را با هم پیشنهاد می‌دهد.

## پاسخ به انتخاب

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

- `interaction.values` مقدارهای انتخاب‌شده را نگه می‌دارد (مقدار گزینه‌ها، یا شناسه‌ها در نوع‌های دیگر).
- `users`، `members`، `roles` و `channels` شیءهای انتخاب‌شده را نگه می‌دارند.
- `isAnySelectMenu()` برای همهٔ نوع‌ها درست است.

مثل [دکمه‌ها](./buttons.md)، با `update()`، `deferUpdate()` یا `reply()` پاسخ دهید.

::: info هنوز در بی‌سیم نیست
مقدار از پیش انتخاب‌شده برای منوهای کاربر، نقش و کانال (`setDefaultUsers()` و مانند آن) یک `BisimjsError`
می‌دهد.
:::
