# دسترسی‌ها

## چه کسی می‌تواند از دستور استفاده کند

`setDefaultMemberPermissions()` دستور را از اعضایی که همهٔ دسترسی‌های داده‌شده را ندارند پنهان می‌کند. بی‌سیم
همان بیت‌های دسترسی دیسکورد را به کار می‌برد، پس مقدارها همان‌هایی هستند که می‌شناسید.

```js
const { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('bisim.js');

const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Times a member out for ten minutes')
  .addUserOption((option) => option.setName('member').setDescription('Who to time out').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);
```

- `setDefaultMemberPermissions(0)` دستور را فقط به مدیران کل (Administrator) نشان می‌دهد.
- دسترسی‌ها را با `|` ترکیب کنید: `PermissionFlagsBits.KickMembers | PermissionFlagsBits.BanMembers`.
- مدیران کل همهٔ دستورها را می‌بینند.

بی‌سیم این را هم بررسی می‌کند که عضو در آن کانال دسترسی **استفاده از دستورهای برنامه‌ها** (Use Application
Commands) را داشته باشد و محروم موقت (timeout) نباشد.

## دستور کجا اجرا می‌شود

بی‌سیم دستورها را در سرورها و در پیام خصوصی خود ربات اجرا می‌کند. با `setContexts()` می‌توانید دستور را به یکی
از این دو محدود کنید:

```js
const { InteractionContextType } = require('bisim.js');

new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Information about this server')
  .setContexts(InteractionContextType.Guild);
```

`InteractionContextType.Guild` و `InteractionContextType.BotDM` دو حالتی هستند که بی‌سیم دارد. شکل قدیمی‌تر
`setDMPermission(false)` هم کار می‌کند و همان معنای «فقط در سرور» را دارد.

## بررسی دسترسی در کد

دسترسی پیش‌فرض نخستین لایهٔ کنترل است و مدیران سرور می‌توانند آن را تنظیم کنند. برای کارهای حساس، در کد هم بررسی
کنید:

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

- `interaction.memberPermissions` کارهایی است که عضو در آن کانال می‌تواند انجام دهد.
- `interaction.appPermissions` کارهایی است که ربات شما در آن‌جا می‌تواند انجام دهد.
- `member.bannable`، `kickable`، `manageable` و `moderatable` جایگاه نقش‌ها را همان‌طور که بی‌سیم مقایسه
  می‌کند می‌سنجند.
